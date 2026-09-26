import { getChatProvider } from "@/lib/ai/provider";
import { buildContextBlock, buildSystemPrompt, extractMarks } from "@/lib/ai/prompt";
import { verifyAnswer } from "@/lib/ai/verifier";
import { answerCacheKey, getCachedAnswer, setCachedAnswer } from "@/lib/rag/cache";
import { hasApprovedCompetencyQuestion, retrieve } from "@/lib/rag/retriever";
import { isExamStyleRoute, routeQuery } from "@/lib/rag/router";
import type { ChatEvent, ChatRequestBody } from "@/lib/types";
import { authenticatedUser } from "@/lib/auth/supabase";
import { conversationIntent, conversationReply } from "@/lib/ai/conversation";
import { getSyllabusRestriction } from "@/lib/rag/syllabus-index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retrieve → prompt → stream. The client consumes the SSE frames defined by
 * ChatEvent, so adding a new signal (say, a suggested diagram) means adding one
 * variant there and one case in the reducer — not reshaping this route.
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!await authenticatedUser(token)) {
    return Response.json({ error: "Sign in to ask a question." }, { status: 401 });
  }
  const body = (await req.json()) as ChatRequestBody;
  const { messages, context } = body;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      try {
        const last = messages.at(-1);
        const typedQuery =
          last?.content
            .filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join(" ") ?? "";
        const hasImages = Boolean(last?.content.some((p) => p.type === "image"));
        // Read an uploaded question before choosing a syllabus scope. The image
        // itself is the student's question; typing a caption is optional.
        let query = typedQuery;
        let imageSubject: "maths" | "science" | undefined;
        if (hasImages) {
          const provider = getChatProvider();
          let observation = "";
          for await (const delta of provider.stream({
            system: "Read the student's image as a Class 10 CBSE question. Transcribe the visible question and answer options, then describe any diagram, labels, values, and units needed to find the topic. Do not solve it. Start your response with exactly 'SUBJECT: Maths' or 'SUBJECT: Science', followed by a newline and 'QUESTION: ' with the transcription and diagram description. If unreadable, write 'QUESTION: UNREADABLE'. Physics and Chemistry are Science.",
            messages: [{ role: "user", content: last?.content ?? [] }],
            signal: req.signal,
            hasImages: true,
          })) observation += delta;
          imageSubject = /^SUBJECT:\s*Maths\b/im.test(observation)
            ? "maths"
            : /^SUBJECT:\s*Science\b/im.test(observation)
              ? "science"
              : undefined;
          const extracted = observation.match(/^QUESTION:\s*([\s\S]*)/im)?.[1]?.trim();
          if (extracted && !/^UNREADABLE\b/i.test(extracted)) {
            query = [typedQuery, extracted].filter(Boolean).join("\n");
          }
        }
        if (!query.trim()) {
          send({ type: "token", text: hasImages
            ? "I couldn't read the question in that image. Please upload a clearer crop or type the question."
            : "Ask a Maths or Science question to get a source-backed answer." });
          send({ type: "done" });
          return;
        }
        if (!hasImages) {
          const intent = conversationIntent(query);
          if (intent) {
            send({ type: "token", text: conversationReply(intent, query) });
            send({ type: "done" });
            return;
          }
        }
        const route = context.mode === "drill" ? "competency" : routeQuery(query);
        const cacheKey = answerCacheKey({
          query,
          subject: imageSubject ?? context.subject,
          chapter: context.chapter,
          mode: context.mode,
          marks: context.marks,
        });

        if (query.trim() && !hasImages) {
          const cached = await getCachedAnswer(cacheKey).catch(() => null);
          if (cached) {
            if (cached.sources.length) send({ type: "sources", sources: cached.sources });
            if (cached.text) send({ type: "token", text: cached.text });
            if (cached.steps?.length) send({ type: "steps", steps: cached.steps, marks: cached.marks });
            if (cached.notice) send({ type: "notice", message: cached.notice });
            send({ type: "done" });
            return;
          }
        }

        // 1. Retrieve. Sources go out first so the UI can show what it's
        //    reading from while the model is still thinking.
        let sources: Awaited<ReturnType<typeof retrieve>> = [];
        let retrievalFailed = false;
        if (query.trim()) {
          try {
            sources = await retrieve(query, {
              subject: imageSubject ?? context.subject,
              chapter: context.chapter,
              kinds:
                route === "diagram"
                  ? ["ncert", "diagram", "ms"]
                  : route === "competency"
                    ? ["cfpq", "sqp", "pyq"]
                  : route === "marking" || route === "pyq"
                    ? ["ncert", "pyq", "sqp", "ms", "diagram"]
                    : undefined,
              route,
              topK: 4,
            });
          } catch (err) {
            console.error("retrieval failed", err);
            retrievalFailed = true;
          }
        }

        const hasSyllabusScope = sources.some(
          (source) => source.kind === "syllabus" && source.chunkType === "syllabus_scope",
        );
        if (query.trim() && !hasSyllabusScope) {
          const restriction = getSyllabusRestriction(query, imageSubject ?? context.subject);
          send({
            type: "token",
            text: retrievalFailed
              ? "I can't reach the verified CBSE material right now. Please retry in a moment; I can't judge the syllabus from a connection failure."
              : restriction === "formative"
                ? "This is listed as a formative topic in the current CBSE curriculum. I don't have approved material for a grounded explanation yet, and I won't present it as a year-end board topic."
                : restriction === "excluded"
                  ? "This topic is outside the current year-end board-answer scope. I can help with a current Maths or Science topic instead."
                  : restriction === "unlaunched"
                    ? "Padhle currently covers Class 10 Maths and Science. That subject is not available yet."
                    : "I couldn't find an approved source for this question yet. That does not mean the topic is out of syllabus; I won't guess an answer from memory.",
          });
          send({ type: "done" });
          return;
        }
        if (query.trim() && !sources.some((source) => source.kind !== "syllabus")) {
          send({
            type: "token",
            text: "This topic is in the active syllabus, but I don't have enough approved source material to answer it yet.",
          });
          send({ type: "done" });
          return;
        }
        if (query.trim() && route === "competency" && !hasApprovedCompetencyQuestion(sources)) {
          send({
            type: "token",
            text: "This topic is in the active syllabus, but no approved competency-based question from a mapped CBSE question bank is available yet.",
          });
          send({ type: "done" });
          return;
        }

        // An approved question block is already the finished practice prompt.
        // Present it exactly as reviewed, without spending a free model call or
        // leaking the matching marking-scheme answer into the source panel.
        if (route === "competency") {
          const question = sources.find((source) =>
            ["cfpq", "sqp", "pyq"].includes(source.kind) &&
            ["question_block", "question_part"].includes(source.chunkType ?? ""),
          );
          if (question) {
            const visibleSources = [
              ...sources.filter((source) => source.kind === "syllabus").slice(0, 1),
              question,
            ];
            send({ type: "sources", sources: visibleSources });
            const text = `Practice question:\n\n${question.content} [[source:${question.id}]]`;
            send({ type: "token", text });
            if (!hasImages) {
              await setCachedAnswer(cacheKey, {
                text,
                sources: visibleSources,
              }).catch(() => undefined);
            }
            send({ type: "done" });
            return;
          }
        }

        send({ type: "sources", sources });

        // 2. Prompt.
        const hasMarkingScheme = sources.some(
          (s) => s.kind === "ms" || s.chunkType === "marking_scheme",
        );
        const examStyle = context.mode === "answer" && isExamStyleRoute(route);

        const system = buildSystemPrompt(context, sources, route);
        const evidenceMessage = {
          role: "user" as const,
          content: [{ type: "text" as const, text: buildContextBlock(sources) }],
        };
        // Vision has already turned the uploaded image into a question. Reuse
        // that transcription for answering so a second, costly vision request
        // cannot reroute the question or exhaust a free image-model quota.
        const answerMessages = [
          ...messages.slice(0, -1).map((message) => ({
            role: message.role,
            content: message.content.filter((part) => part.type === "text"),
          })).filter((message) => message.content.length),
          { role: "user" as const, content: [{ type: "text" as const, text: query }] },
        ];

        // 3. Generate into a short server-side buffer. Structural verification
        //    happens before anything reaches the answer sheet, so an invalid
        //    citation or invented mark can never flash on screen.
        const provider = getChatProvider();
        const generate = async (prompt: string) => {
          let text = "";
          for await (const delta of provider.stream({
            system: prompt,
            messages: [evidenceMessage, ...answerMessages],
            signal: req.signal,
            hasImages: false,
          })) {
            text += delta;
          }
          return text;
        };

        const sourceOnlyFallback = (error: unknown) => {
          if (!(error instanceof Error) || !error.message.includes("free answer models are busy")) return false;
          const ncert = sources.find((source) => source.kind === "ncert");
          if (!ncert) return false;
          const firstSentence = ncert.snippet.split(/(?<=[.!?])\s/)[0];
          const excerpt = firstSentence.split(/\s+/).slice(0, 25).join(" ");
          send({
            type: "token",
            text: `The free answer model is busy. Closest reviewed NCERT line: “${excerpt}” [[source:${ncert.id}]]. Please retry for a tailored answer.`,
          });
          send({ type: "done" });
          return true;
        };

        let verified: Awaited<ReturnType<typeof verifyAnswer>>;
        try {
          let full = await generate(system);
          verified = await verifyAnswer(full, sources, route);
          if (!verified.citationOk || !verified.nliOk) {
            full = await generate(
              `${system}\n\nRETRY: The previous draft failed grounding verification. Regenerate once using only claims supported by CONTEXT and only the exact ids shown in the evidence message.`,
            );
            verified = await verifyAnswer(full, sources, route);
          }
        } catch (error) {
          if (sourceOnlyFallback(error)) return;
          throw error;
        }

        if (!verified.citationOk || !verified.nliOk) {
          verified = {
            ...verified,
            text: "This topic is in the active syllabus, but I couldn't verify a grounded answer from the approved passages yet.",
          };
        }

        const { text: answerText, steps, marks } = extractMarks(verified.text);
        if (answerText) send({ type: "token", text: answerText });
        if (hasMarkingScheme && steps?.length) {
          send({ type: "steps", steps, marks });
        } else if (verified.notice || (!hasMarkingScheme && examStyle)) {
          send({
            type: "notice",
            message:
              verified.notice ??
              "Mark allocation unavailable without an approved marking scheme.",
          });
        }

        if (query.trim() && !hasImages) {
          await setCachedAnswer(cacheKey, {
            text: answerText,
            sources,
            steps,
            marks,
            notice:
              verified.notice ??
              (!hasMarkingScheme && examStyle
                ? "Mark allocation unavailable without an approved marking scheme."
                : undefined),
          }).catch(() => undefined);
        }

        send({ type: "done" });
      } catch (err) {
        send({
          type: "error",
          message:
            err instanceof Error ? err.message : "The model didn't respond.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
