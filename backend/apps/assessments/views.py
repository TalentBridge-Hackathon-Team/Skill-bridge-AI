import re
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import AssessmentTask, AssessmentSubmission, MicroLessonProgress
from .serializers import AssessmentTaskSerializer, AssessmentSubmissionSerializer, MicroLessonProgressSerializer
from .evaluator import RubricEvaluator

class AssessmentDetailView(APIView):
    """
    GET /api/assessments/{task_id}/
    Retrieves task instructions, rubric definition, and target skill,
    and returns the learner's previous submission if one exists so they can refer to it later.
    """
    def get(self, request, task_id):
        user_id = request.query_params.get("user_id", "usr_demo_001")
        target_skill = request.query_params.get("target_skill")

        task = AssessmentTask.objects.filter(task_id=task_id).first()
        if not task and target_skill:
            task = AssessmentTask.objects.filter(target_skill__iexact=target_skill).first()

        if not task:
            task = AssessmentTask.objects.create(
                task_id=task_id,
                title=f"Practical Technical Assessment: {target_skill or 'API Testing'}",
                task_type="technical_assessment",
                target_skill=target_skill or "API Testing",
                total_points=10,
                instructions=(
                    f"Write and submit your practical engineering deliverable for {target_skill or 'API Testing'}. "
                    "Demonstrate core implementation, boundary validation, security handling, and engineering trade-offs."
                ),
                rubric=[
                    {"id": "c1", "name": "Core Implementation", "points": 2, "description": f"Implements primary deliverable for {target_skill or 'skill'}."},
                    {"id": "c2", "name": "Edge Case & Validation Guard", "points": 2, "description": "Guards against malformed or invalid inputs."},
                    {"id": "c3", "name": "Security & Auth Boundary", "points": 3, "description": "Enforces authorization and boundary constraints."},
                    {"id": "c4", "name": "Output Assertions & Contracts", "points": 2, "description": "Verifies output structure and contract adherence."},
                    {"id": "c5", "name": "Engineering Rationale", "points": 1, "description": "Explains architectural trade-offs and rationale."}
                ]
            )

        task_data = AssessmentTaskSerializer(task).data

        # Attach latest submission for the user so they can refer to their saved answers
        user_candidates = list(filter(None, {user_id, "usr_demo_001", "demo_user"}))
        latest_sub = AssessmentSubmission.objects.filter(
            task=task,
            user_id__in=user_candidates
        ).order_by("-submitted_at").first()
        if not latest_sub and target_skill:
            latest_sub = AssessmentSubmission.objects.filter(
                task__target_skill__iexact=target_skill,
                user_id__in=user_candidates
            ).order_by("-submitted_at").first()

        if latest_sub:
            task_data["latest_submission"] = AssessmentSubmissionSerializer(latest_sub).data

        return Response(task_data)

class AssessmentSubmissionView(APIView):
    """
    POST /api/assessments/{task_id}/submissions/
    Submit test cases, GitHub link, or file for 10-point rubric evaluation.
    Auto-detects struggle, provides personalized visual/hands-on support,
    and updates Roadmap & Profile evidence when passed.
    """
    def post(self, request, task_id):
        user_id = request.data.get("user_id", "usr_demo_001")
        submission_type = request.data.get("submission_type", "code")
        submission_payload = request.data.get("submission", {})
        learning_preference = request.data.get("learning_preference", "visual")
        target_role = request.data.get("target_role", "Junior Backend Developer")

        target_skill = request.data.get("target_skill", "API Testing")

        # 1. Fetch or create task
        task, created = AssessmentTask.objects.get_or_create(
            task_id=task_id,
            defaults={
                "title": f"Practical Technical Assessment: {target_skill}",
                "task_type": "technical_assessment",
                "target_skill": target_skill,
                "total_points": 10,
                "instructions": f"Submit comprehensive engineering deliverables for {target_skill}."
            }
        )
        if not created and (not task.target_skill or task.target_skill != target_skill):
            task.target_skill = target_skill
            task.save()

        # 2. Evaluate via RubricEvaluator for this specific skill gap
        evaluator = RubricEvaluator()
        result = evaluator.evaluate(
            task_id=task_id,
            user_id=user_id,
            submission_type=submission_type,
            submission_payload=submission_payload,
            learning_preference=learning_preference,
            target_role=target_role,
            target_skill=target_skill
        )

        # 2b. AWS S3 & SQS Pipeline Integration (Persists deliverable to S3 and dispatches SQS event)
        aws_metadata = {}
        if submission_type == "file":
            filename = submission_payload.get("filename", f"{target_skill.lower().replace(' ', '_')}_deliverable.sql")
            content = submission_payload.get("content", "")
            if content:
                try:
                    from services.aws_service import resume_pipeline
                    s3_res = resume_pipeline.upload_resume(
                        file_source=content.encode("utf-8"),
                        user_id=user_id,
                        filename=filename,
                        content_type="text/plain"
                    )
                    if s3_res.get("success"):
                        aws_metadata["s3_url"] = s3_res.get("s3_url")
                        aws_metadata["bucket"] = s3_res.get("bucket")
                        aws_metadata["key"] = s3_res.get("key")
                        sqs_res = resume_pipeline.dispatch_processing_job(
                            bucket=s3_res.get("bucket", "skillbridge-resumes"),
                            key=s3_res.get("key", ""),
                            user_id=user_id,
                            filename=filename
                        )
                        aws_metadata["sqs_message_id"] = sqs_res.get("message_id")
                        result["aws_pipeline"] = aws_metadata
                except Exception as aws_err:
                    import logging
                    logging.getLogger(__name__).warning("AWS S3/SQS upload error: %s", aws_err)

        # 3. Save submission record
        submission_record = AssessmentSubmission.objects.create(
            submission_id=result["submission_id"],
            task=task,
            user_id=user_id,
            task_type=task.task_type,
            submission_data={
                "type": submission_type,
                "payload": submission_payload,
                "target_skill": target_skill,
                "learning_preference": learning_preference,
                "aws_pipeline": aws_metadata
            },
            score=result["score"],
            max_score=result["max_score"],
            feedback={
                "criteria_breakdown": result["criteria_breakdown"],
                "overall_feedback": result["overall_feedback"],
                "personalized_support": result["personalized_support"]
            },
            status=result["status"]
        )

        return Response(result, status=status.HTTP_201_CREATED)

    def get(self, request, task_id):
        """Retrieves history of submissions for this task and latest user answers so they can refer back later."""
        user_id = request.query_params.get("user_id", "usr_demo_001")
        target_skill = request.query_params.get("target_skill")
        user_candidates = list(filter(None, {user_id, "usr_demo_001", "demo_user"}))

        q = AssessmentSubmission.objects.filter(user_id__in=user_candidates)
        if task_id and task_id != "latest":
            q = q.filter(task_id=task_id)
        elif target_skill:
            q = q.filter(task__target_skill__iexact=target_skill)

        submissions = q.order_by("-submitted_at")
        serializer = AssessmentSubmissionSerializer(submissions, many=True)
        latest = serializer.data[0] if serializer.data else None
        return Response({
            "task_id": task_id,
            "latest_submission": latest,
            "submissions": serializer.data
        })


class MicroLessonProgressView(APIView):
    """
    GET /api/assessments/micro-lesson/progress/?user_id=...&skill_name=...
    POST /api/assessments/micro-lesson/progress/
    Persists and retrieves the learner's micro-lesson state, unlocked hint level,
    learning preference, experience level, struggle topics, and Socratic mentor chats
    directly in the dedicated PostgreSQL database.
    """
    def get(self, request):
        user_id = request.query_params.get("user_id", "usr_demo_001")
        skill_name = request.query_params.get("skill_name", "PostgreSQL")

        progress, created = MicroLessonProgress.objects.get_or_create(
            user_id=user_id,
            skill_name=skill_name,
            defaults={
                "unlocked_hint_level": 1,
                "learning_preference": "visual",
                "experience_level": "intermediate",
                "chat_history": [
                    {
                        "id": "m_welcome",
                        "sender": "mentor",
                        "text": f"Hello! I am your Socratic Engineering Mentor for {skill_name}. Ask or challenge me on any concept, constraint, or execution step! I will guide you with analogies, mental models, and diagnostic questions tailored to your experience level, but I will never reveal the answer directly.",
                        "socraticQuestion": f"Diagnostic challenge: In {skill_name}, what is the critical invariant that must be guaranteed before state mutation occurs?",
                        "source": "system_guard",
                        "model": "Socratic Curriculum Engine"
                    }
                ],
                "struggle_topics": []
            }
        )
        return Response(MicroLessonProgressSerializer(progress).data)

    def post(self, request):
        user_id = request.data.get("user_id", "usr_demo_001")
        skill_name = request.data.get("skill_name", "PostgreSQL")
        unlocked_hint_level = request.data.get("unlocked_hint_level", 1)
        chat_history = request.data.get("chat_history", [])
        learning_preference = request.data.get("learning_preference", "visual")
        experience_level = request.data.get("experience_level", "intermediate")
        struggle_topics = request.data.get("struggle_topics", [])

        progress, _ = MicroLessonProgress.objects.update_or_create(
            user_id=user_id,
            skill_name=skill_name,
            defaults={
                "unlocked_hint_level": unlocked_hint_level,
                "chat_history": chat_history,
                "learning_preference": learning_preference,
                "experience_level": experience_level,
                "struggle_topics": struggle_topics,
            }
        )
        return Response(MicroLessonProgressSerializer(progress).data)


class MicroLessonChatView(APIView):
    """
    POST /api/assessments/micro-lesson/chat/
    Intelligent Socratic Engineering Mentor powered by OpenRouter (google/gemma-4-26b-a4b-it:free).
    - Adapts to user skill gap, experience level (beginner/intermediate/advanced), and learning preference (visual/hands-on/socratic).
    - Defends against system prompt extraction and credential leaks.
    - Handles out-of-context queries politely and refocuses on software engineering concepts.
    - Prevents raw copy-paste solution dumps while explaining system mechanics, edge cases, and architectures generously.
    - Attaches interactive concept animations (including Vector Search, B-Tree, Concurrency, Pipeline, Boundary) on demand.
    - Features a rich, skill-aware fallback engine preventing repetitive robotic one-liners.
    - Persists full chat conversation state to the dedicated PostgreSQL database.
    """
    def post(self, request):
        user_id = request.data.get("user_id", "usr_demo_001")
        skill_name = request.data.get("skill_name") or request.data.get("topic") or "Python"
        message = (request.data.get("message") or "").strip()
        learning_preference = request.data.get("learning_preference", "visual")
        experience_level = request.data.get("experience_level", "intermediate")

        if not message:
            return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Retrieve existing progress record
        progress, _ = MicroLessonProgress.objects.get_or_create(
            user_id=user_id,
            skill_name=skill_name,
            defaults={
                "unlocked_hint_level": 1,
                "learning_preference": learning_preference,
                "experience_level": experience_level,
                "chat_history": [
                    {
                        "id": "m_welcome",
                        "sender": "mentor",
                        "text": f"Hello! I am your Socratic Engineering Mentor for {skill_name}. Ask or challenge me on any concept, constraint, or execution step! I will guide you with analogies, mental models, and diagnostic questions tailored to your experience level, but I will never reveal the answer directly.",
                        "socraticQuestion": f"Diagnostic challenge: In {skill_name}, what is the critical invariant that must be guaranteed before state mutation occurs?",
                        "source": "system_guard",
                        "model": "Socratic Curriculum Engine"
                    }
                ],
                "struggle_topics": []
            }
        )

        reply, socratic_q, concept_anim, struggle_topic, source, model_name = self._generate_mentor_response(
            message=message,
            skill_name=skill_name,
            experience_level=experience_level,
            learning_preference=learning_preference,
            chat_history=list(progress.chat_history or [])
        )

        import time
        now_ts = int(time.time() * 1000)
        learner_msg = {
            "id": f"l_{now_ts}",
            "sender": "learner",
            "text": message
        }

        mentor_msg = {
            "id": f"m_{now_ts + 1}",
            "sender": "mentor",
            "text": reply,
            "socraticQuestion": socratic_q,
            "source": source,
            "model": model_name
        }
        if concept_anim:
            mentor_msg["conceptAnimation"] = concept_anim

        current_history = list(progress.chat_history or [])
        current_history.extend([learner_msg, mentor_msg])

        struggle_list = list(progress.struggle_topics or [])
        if struggle_topic and struggle_topic not in struggle_list:
            struggle_list.append(struggle_topic)

        # Persist updated chat history to dedicated Neon PostgreSQL database
        progress.chat_history = current_history
        progress.learning_preference = learning_preference
        progress.experience_level = experience_level
        progress.struggle_topics = struggle_list
        progress.save()

        return Response({
            "reply": reply,
            "socraticQuestion": socratic_q,
            "conceptAnimation": concept_anim,
            "source": source,
            "model": model_name,
            "chat_history": current_history,
            "unlocked_hint_level": progress.unlocked_hint_level,
            "experience_level": experience_level,
            "learning_preference": learning_preference
        })

    def _detect_domain(self, skill_name: str, message: str = "") -> str:
        combined = f"{skill_name} {message}".lower()
        if any(k in combined for k in [
            "pytorch", "torch", "tensorflow", "keras", "scikit-learn", "sklearn",
            "deep learning", "neural network", "transformer", "huggingface", "llm",
            "autograd", "dataloader", "tensor", "gradient descent", "backprop",
            "cnn", "rnn", "lstm", "cuda", "loss.backward", "nn.module", "optimizer",
            "weights", "activation", "loss function", "crossentropyloss", "adamw"
        ]):
            return "ml_ai"
        if any(k in combined for k in ["vector", "embedding", "hnsw", "cosine", "pgvector", "rag", "nearest neighbor", "faiss"]):
            return "vector_ai"
        if any(k in combined for k in ["postgres", "postgresql", "mysql", "sqlite", "redis", "mongodb", "sql", "btree", "b-tree", "wal", "acid", "query planner"]):
            return "database"
        if any(k in combined for k in ["docker", "container", "kubernetes", "k8s", "aws", "s3", "sqs", "lambda", "ci/cd", "terraform", "devops"]):
            return "devops_cloud"
        if any(k in combined for k in ["jwt", "oauth", "token", "auth", "rbac", "secret key", "csrf", "xss", "cors"]):
            return "security"
        if any(k in combined for k in ["react", "vue", "angular", "typescript", "javascript", "css", "tailwind", "next.js", "virtual dom", "frontend"]):
            return "frontend"
        if any(k in combined for k in ["api", "rest", "django", "drf", "fastapi", "flask", "express", "node", "endpoint", "serializer", "viewset", "middleware"]):
            return "backend_api"
        if any(k in combined for k in ["algorithm", "data structure", "tree", "graph", "binary search", "sorting", "dynamic programming", "recursion", "big-o"]):
            return "algorithms"
        return "general_engineering"

    def _generate_mentor_response(self, message: str, skill_name: str, experience_level: str, learning_preference: str, chat_history: list):
        lower = message.lower().strip()
        domain = self._detect_domain(skill_name, message)
        wants_animation = any(w in lower for w in ["animation", "visual", "show me", "animate", "diagram", "draw", "flowchart", "step by step"])
        shows_struggle = any(w in lower for w in ["don't understand", "confused", "struggling", "why", "hard", "lost", "fail", "not sure", "how does", "what is", "explain", "detail", "predictable"])

        # 1. Security & Edge Case Defense: System prompt, credential & secret leaks
        secret_leak_indicators = [
            "system prompt", "system instruction", "reveal prompt", "ignore previous instructions",
            "api_key", "apikey", "secret_key", "secret key", "database_url", "aws_secret",
            "openrouter_api_key", "env var", "environment variable", "credentials", "auth token"
        ]
        if any(sec in lower for sec in secret_leak_indicators):
            reply = (
                f"I am your dedicated SkillBridge Engineering Mentor for {skill_name}. My role is to help you "
                "master software engineering concepts, understand architectural trade-offs, and pass your practical deliverables. "
                "I cannot disclose internal system prompts, tokens, or infrastructure credentials. "
                f"Let's stay focused on mastering {skill_name} and building production-ready deliverables!"
            )
            socratic_q = f"What specific architectural question can I help guide you on regarding {skill_name}?"
            return reply, socratic_q, None, None, "system_guard", "Security Guardrail"

        # 2. Out-of-Context Boundary Filter
        unrelated_indicators = [
            "recipe", "cooking", "cake", "bake", "pizza", "celebrity", "hollywood", "horoscope",
            "poem about", "write a song", "football score", "presidential election", "medical diagnosis"
        ]
        if any(u in lower for u in unrelated_indicators):
            reply = (
                f"I am focused specifically as your SkillBridge Engineering Mentor for {skill_name}. To help you reach "
                f"technical role readiness and excel in practical interviews, let's keep our session centered on {skill_name} "
                "concepts, architectural design, and your practical assessment deliverable."
            )
            socratic_q = f"Would you like to explore how {skill_name} operates under the hood, or look at how to test its edge cases?"
            return reply, socratic_q, None, None, "system_guard", "Topic Guardrail"

        # 3. Attempt LLM Generation: Route to Google Gemini first, cascade to OpenRouter
        try:
            from services.gemini_service import gemini_service
            from services.openrouter_service import OpenRouterService

            llm_res = None
            if domain == "ml_ai":
                level_instructions = {
                    "beginner": "Explain using intuitive real-world metaphors (e.g. adjusting recipe knobs, scorecards, assembly lines). Focus on tensors as multi-dimensional data grids, forward pass as predictions, loss as error score, and backward pass as tuning knobs. Avoid web or database terminology.",
                    "intermediate": "Focus on standard PyTorch and deep learning engineering patterns: modular nn.Module design, Autograd graph dynamics, training loop invariants (zero_grad -> forward -> loss -> backward -> step), DataLoader batching, and inference isolation (model.eval(), torch.no_grad()). DO NOT mention Django, web routers, or HTTP status codes.",
                    "advanced": "Deep-dive into tensor stride and memory layout, CUDA VRAM allocation, mixed precision (torch.cuda.amp), gradient clipping, vanishing/exploding gradients, distributed training (DDP), and avoiding memory leaks with loss.item()."
                }.get(experience_level, "Focus on deep learning architecture and tensor operations.")
                style_instructions = {
                    "visual": "Always include a clear text-based ASCII execution flowchart showing DataLoader batch tensors -> forward pass -> loss criterion -> autograd backward -> optimizer step.",
                    "hands_on": "Include practical PyTorch assertions (e.g. assert outputs.shape == (batch_size, classes), assert not torch.isnan(loss)).",
                    "socratic": "Explore Autograd and deep learning trade-offs (e.g. why loss.backward accumulates gradients instead of overwriting, when to use AdamW vs SGD)."
                }.get(learning_preference, "Use practical PyTorch examples.")
            elif domain == "database":
                level_instructions = {
                    "beginner": "Explain using book index analogies: flipping to page vs reading cover-to-cover.",
                    "intermediate": "Focus on B-Tree indexing, execution plans (EXPLAIN ANALYZE), ACID transaction isolation, and foreign key cascades.",
                    "advanced": "Deep-dive into query cost models, buffer cache hit ratios, WAL flushes, row locks (SELECT FOR UPDATE), and index bloat."
                }.get(experience_level, "Focus on relational database architecture.")
                style_instructions = {
                    "visual": "Include an ASCII diagram of query execution through B-tree index hops vs sequential disk scan.",
                    "hands_on": "Include SQL index statements and EXPLAIN ANALYZE query verification.",
                    "socratic": "Explore indexing trade-offs (e.g. read latency acceleration vs write amplification)."
                }.get(learning_preference, "Use SQL examples.")
            else:
                level_instructions = {
                    "beginner": "Explain using intuitive everyday analogies (like airport check-in or restaurant ordering). Avoid confusing academic or systems jargon; explain step-by-step.",
                    "intermediate": "Focus on standard production patterns, boundary validation, and clean interface contracts.",
                    "advanced": "Deep-dive into systems internals, memory footprint, lock contention, isolation levels, and latency trade-offs."
                }.get(experience_level, "Focus on practical software architecture.")
                style_instructions = {
                    "visual": "Always include a clear text-based ASCII execution flowchart showing the step-by-step path of data.",
                    "hands_on": "Include concrete input schemas, boundary parameters, and test assertion patterns.",
                    "socratic": "Explore architectural trade-offs (e.g. why choice A vs choice B), question assumptions, and use guided reasoning."
                }.get(learning_preference, "Use practical examples.")

            system_prompt = (
                f"You are a Senior Staff Engineering Mentor guiding a software engineer on {skill_name}.\n"
                f"Domain: {domain.upper()}. Learner Level: {experience_level.upper()} ({level_instructions}). Preferred Style: {learning_preference.upper()} ({style_instructions}).\n\n"
                f"Response Requirements:\n"
                f"• Authoritative Engineering Guidance: Provide clear technical explanations, production edge cases, and architectural trade-offs.\n"
                f"• Strict Anti-Cheating Invariant: NEVER provide a complete copy-paste solution to the user's assessment deliverable. When asked for 'the solution', 'the answer', or to 'write the task code', do NOT dump working full code. Instead, provide skeletal contract blueprints with `# TODO: implement` placeholders, outline boundary constraints, explain the design pattern with generic analogies, and guide them with Socratic questions so the learner builds the deliverable themselves.\n"
                f"• If style is visual or the user asks for a flow, provide an intuitive ASCII data-flow diagram.\n"
                f"• Stay strictly grounded in {skill_name} and its actual domain ({domain}). Never hallucinate unrelated frameworks.\n"
                f"• Provide test assertion contracts and boundary parameters where relevant.\n"
                f"• Conclude with a single diagnostic follow-up question labeled 'Diagnostic Challenge: <question>'.\n"
                f"• Output ONLY the direct user-facing response. Never output internal planning notes, scratchpads, or meta-commentary."
            )

            # Multi-turn conversation context
            clean_recent_history = []
            for h in (chat_history[-6:] if chat_history else []):
                clean_text = self._sanitize_llm_response(h.get("text", "") or h.get("content", ""))
                if clean_text:
                    clean_recent_history.append({
                        "role": "user" if h.get("sender") == "learner" else "assistant",
                        "content": clean_text
                    })

            # Primary Route: Direct Google Gemini API
            if gemini_service.is_configured():
                llm_res = gemini_service.generate_text(
                    prompt=message,
                    system_prompt=system_prompt,
                    temperature=0.3,
                    max_tokens=2500,
                    conversation_messages=clean_recent_history
                )

            # Secondary Route: OpenRouter Cascade (if Gemini not configured or failed)
            if not llm_res or not llm_res.get("success"):
                openrouter = OpenRouterService()
                if openrouter.api_key:
                    llm_res = openrouter.generate_text(
                        prompt=message,
                        system_prompt=system_prompt,
                        temperature=0.3,
                        max_tokens=2500,
                        conversation_messages=clean_recent_history
                    )

            if llm_res and llm_res.get("success") and llm_res.get("text"):
                raw_text = self._sanitize_llm_response(llm_res["text"].strip())
                reply_body = raw_text
                socratic_q = ""

                # Robust extraction of the concluding Diagnostic Challenge question (handles markdown bolding and line breaks)
                diag_match = re.search(r'(?:\n|\A)\s*(?:\*{0,2}\s*Diagnostic\s*(?:Challenge)?\s*:?\s*\*{0,2})\s*:?\s*(.*)\Z', raw_text, flags=re.IGNORECASE | re.DOTALL)
                if diag_match and diag_match.group(1).strip():
                    reply_body = raw_text[:diag_match.start()].strip()
                    socratic_q = diag_match.group(1).strip().lstrip("*:").strip()
                else:
                    socratic_q = f"In your implementation of {skill_name}, what edge case or invariant would cause this mechanism to fail?"

                # Anti-Hallucination Guardrail: Prevent web abstractions from contaminating ML topics
                if domain == "ml_ai" and any(bad in reply_body.lower() for bad in ["django middleware", "url router", "http 401", "403 forbidden", "response serializer"]):
                    reply_body, socratic_q, concept_anim, struggle_topic = self._generate_rich_fallback(
                        message, skill_name, experience_level, learning_preference, wants_animation, shows_struggle
                    )
                    return reply_body, socratic_q, concept_anim, struggle_topic, "system_guard", "Anti-Hallucination Guardrail"
                else:
                    concept_anim = self._resolve_concept_animation(skill_name, message, wants_animation or (learning_preference == 'visual'))
                    struggle_topic = self._resolve_struggle_topic(skill_name, message)
                    active_model = llm_res.get("model") or "gemini-3-flash-preview"
                    return reply_body, socratic_q, concept_anim, struggle_topic, "live_ai", active_model
        except Exception:
            pass

        # 4. Rich, Skill-Aware Fallback Engine (visibly differentiates Level and Style)
        fb_reply, fb_socratic, fb_anim, fb_topic = self._generate_rich_fallback(
            message, skill_name, experience_level, learning_preference, wants_animation, shows_struggle
        )
        return fb_reply, fb_socratic, fb_anim, fb_topic, "offline_fallback", "Offline Knowledge Engine"

    def _sanitize_llm_response(self, text: str) -> str:
        """
        Strips internal reasoning scratchpads, <think> tags, and meta-planning commentary
        emitted by reasoning models so only clean, direct engineering guidance reaches the user.
        """
        import re
        if not text:
            return ""
        # 1. Remove <think>...</think> blocks
        cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
        # 2. Remove "Thinking Process: ..." or "Chain of Thought: ..."
        cleaned = re.sub(r'(?i)(?:thinking process|thought process|chain of thought):.*?\n\n', '', cleaned, flags=re.DOTALL)

        # 3. Aggressively filter out lines that match meta-monologue / chain-of-thought
        meta_starters = (
            "we need to", "we must", "so we must", "thus we need", "in this response",
            "let's outline", "outline:", "let's plan", "the user asks", "domain rules",
            "as an adaptive", "as a socratic", "1. stay strictly", "2. tailor", "3. never output",
            "4. if the user", "5. end with", "6. keep responses", "7. critical", "good.",
            "possibly a code", "- a description of", "- an ascii flowchart", "let's unpack this as an ai",
            "let's break down what we need", "this requires:", "we should discuss"
        )
        lines = cleaned.split('\n')
        first_real_idx = 0
        found_real = False
        for idx, line in enumerate(lines):
            l = line.strip().lower()
            if not l:
                continue
            if any(l.startswith(p) for p in meta_starters):
                continue
            first_real_idx = idx
            found_real = True
            break

        if found_real and first_real_idx > 0:
            cleaned = '\n'.join(lines[first_real_idx:]).strip()

        return cleaned or text

    def _resolve_concept_animation(self, skill_name: str, message: str, wants_animation: bool):
        if not wants_animation:
            return None

        combined = f"{skill_name} {message}".lower()
        domain = self._detect_domain(skill_name, message)

        if domain == "ml_ai" or any(w in combined for w in ["pytorch", "torch", "tensor", "gradient", "autograd", "loss", "backprop", "neural", "deep learning"]):
            return {
                "type": "ml_training_loop",
                "title": f"Interactive Deep Learning Flow: {skill_name} Forward & Backward Pass",
                "description": "Visualize how batch tensors propagate forward through layers, calculate loss, and update weights via Autograd."
            }
        elif any(w in combined for w in ["vector", "embedding", "hnsw", "cosine", "nearest neighbor", "distance"]):
            return {
                "type": "vector_search",
                "title": f"Interactive Vector Search: 2048-Dim Embedding & HNSW Cosine Distance",
                "description": "Watch how a query vector traverses the HNSW graph to find nearest neighbors in sub-millisecond time."
            }
        elif any(w in combined for w in ["boundary", "auth", "token", "perimeter", "sanitize", "validate", "unauthorized", "rejection", "check"]):
            return {
                "type": "boundary_check",
                "title": f"Interactive Concept Animation: {skill_name} Verification Boundary",
                "description": "Watch how requests are validated and rejected at the gateway perimeter before reaching the database."
            }
        elif any(w in combined for w in ["index", "btree", "b-tree", "performance", "slow", "fast", "scan", "lookup", "speed", "cardinality", "postgres", "sql"]):
            return {
                "type": "index_btree_search",
                "title": "Interactive Concept Animation: B-Tree Index Traversal vs Sequential Scan",
                "description": "See how B-Tree index pointers eliminate disk I/O by navigating logarithmic tree branches."
            }
        elif any(w in combined for w in ["concurrent", "race", "lock", "conflict", "deadlock", "acid", "transaction", "mutex", "isolation"]):
            return {
                "type": "concurrency_lock",
                "title": "Interactive Concept Animation: Concurrency, Mutex & Row Locks",
                "description": "Visualize what happens when two threads hit conflicting state at the exact same millisecond."
            }
        elif any(w in combined for w in ["pipeline", "aws", "s3", "sqs", "lambda", "queue", "event", "cloud", "async", "worker"]):
            return {
                "type": "pipeline_flow",
                "title": "Interactive Concept Animation: Cloud Event-Driven Pipeline (S3 + SQS + Lambda)",
                "description": "Track how an uploaded deliverable file is stored in S3, enqueued in SQS, and processed by the evaluator."
            }
        elif "vector" in skill_name.lower():
            return {
                "type": "vector_search",
                "title": f"Interactive Vector Search: 2048-Dim Embedding & HNSW Cosine Distance",
                "description": "Watch how a query vector traverses the HNSW graph to find nearest neighbors in sub-millisecond time."
            }
        else:
            return {
                "type": "boundary_check",
                "title": f"Interactive Concept Animation: {skill_name} Execution Flow",
                "description": "Watch how input validation, business logic, and output assertions interact."
            }

    def _resolve_struggle_topic(self, skill_name: str, message: str) -> str:
        combined = f"{skill_name} {message}".lower()
        if any(w in combined for w in ["vector", "embedding", "hnsw"]):
            return "vector_indexing"
        if any(w in combined for w in ["boundary", "security", "auth", "validation"]):
            return "boundary_checks"
        if any(w in combined for w in ["index", "btree", "scan"]):
            return "indexing"
        if any(w in combined for w in ["lock", "concurrency", "race"]):
            return "concurrency_locks"
        if any(w in combined for w in ["pipeline", "aws", "sqs"]):
            return "cloud_pipeline"
        return "core_implementation"

    def _generate_rich_fallback(self, message: str, skill_name: str, experience_level: str, learning_preference: str, wants_animation: bool, shows_struggle: bool):
        lower = f"{skill_name} {message}".lower()
        domain = self._detect_domain(skill_name, message)
        concept_anim = self._resolve_concept_animation(skill_name, message, wants_animation or shows_struggle)
        struggle_topic = self._resolve_struggle_topic(skill_name, message)

        # 0. Machine Learning & PyTorch / Deep Learning
        if domain == "ml_ai" or any(w in lower for w in ["pytorch", "torch", "tensor", "autograd", "dataloader", "neural network", "deep learning", "loss.backward", "nn.module"]):
            if experience_level == "beginner":
                level_desc = (
                    f"In {skill_name}, think of a neural network like an apprentice learning to cook the perfect recipe:\n"
                    "• Tensors: Multi-dimensional trays carrying numbers (images, sounds, or words).\n"
                    "• Forward pass: The apprentice bakes according to current settings (weights) and inspects the dish (predictions).\n"
                    "• Loss function: A score sheet showing how far off the recipe was compared to the target.\n"
                    "• Backward pass (Autograd): The apprentice works backwards to see which knobs need adjusting.\n"
                    "• Optimizer step: Turns the adjustment knobs so the next batch is much closer to perfection!"
                )
            elif experience_level == "advanced":
                level_desc = (
                    f"In production {skill_name} architectures, computational throughput and gradient integrity depend on strict Autograd and memory invariants:\n"
                    "• Dynamic Computational Graph: Tensors with `requires_grad=True` dynamically build DAGs for reverse-mode automatic differentiation.\n"
                    "• Gradient Accumulation vs Zeroing: Calling `optimizer.zero_grad(set_to_none=True)` clears previous iteration `.grad` buffers without expensive memory reallocations.\n"
                    "• VRAM Management: Detaching scalar losses via `loss.item()` prevents CUDA Out-Of-Memory (OOM) accumulation caused by retaining the backward computational graph across epochs.\n"
                    "• Evaluation Mode: `model.eval()` disables Dropout and locks BatchNorm layers to running mean/variance statistics during inference."
                )
            else:  # intermediate
                level_desc = (
                    f"Production engineering in {skill_name} follows four disciplined stages across the training pipeline:\n"
                    "1. Batch Ingestion: DataLoader batches input tensors `[Batch, In_Features]` and transfers them to the target compute device (`.to(device)`).\n"
                    "2. Forward Propagation: Input tensors pass through modular `nn.Module` layers to produce prediction logits.\n"
                    "3. Loss Evaluation: A loss criterion (such as CrossEntropyLoss or MSELoss) calculates prediction error against ground-truth labels.\n"
                    "4. Backpropagation & Optimization: `loss.backward()` calculates gradients via Autograd, and `optimizer.step()` updates model weights."
                )

            if learning_preference == "visual":
                style_addon = (
                    "\n\n[DataLoader: Batch Tensors [B, C, H, W]]\n"
                    "                     │\n"
                    "                     ▼\n"
                    "[nn.Module Forward Pass: Layer Activations & Logits]\n"
                    "                     │\n"
                    "                     ▼\n"
                    "[Loss Function: Criterion(Predictions, GroundTruth)]\n"
                    "                     │\n"
                    "                     ▼\n"
                    "[Autograd: loss.backward() Computes Gradients ∇W]\n"
                    "                     │\n"
                    "                     ▼\n"
                    "[Optimizer: step() Updates Weights; zero_grad() Clears Buffers]"
                )
            elif learning_preference == "hands_on":
                style_addon = (
                    "\n\nPyTorch Training Loop Pattern:\n"
                    "• model.train()\n"
                    "• for inputs, targets in dataloader:\n"
                    "      inputs, targets = inputs.to(device), targets.to(device)\n"
                    "      optimizer.zero_grad()  # Prevent gradient accumulation\n"
                    "      outputs = model(inputs)\n"
                    "      loss = criterion(outputs, targets)\n"
                    "      loss.backward()        # Autograd graph execution\n"
                    "      optimizer.step()       # Parameter update\n\n"
                    "Inference Verification:\n"
                    "• model.eval()\n"
                    "• with torch.no_grad():\n"
                    "      test_loss += criterion(model(x), y).item()"
                )
            else:  # socratic
                style_addon = (
                    "\n\nArchitectural Trade-off Analysis:\n"
                    "By default, `loss.backward()` accumulates (adds) gradients into parameter `.grad` buffers rather than overwriting them. "
                    "When is this behavior advantageous (e.g. gradient accumulation across micro-batches on memory-constrained GPUs), and what catastrophic failure occurs if you forget `optimizer.zero_grad()`?"
                )

            reply = f"{level_desc}{style_addon}"
            socratic_q = f"In {skill_name}, why is calling `optimizer.zero_grad()` before `loss.backward()` essential to prevent gradient accumulation across training batches?"
            return reply, socratic_q, concept_anim, struggle_topic

        # 1. Vector Databases / Semantic Embeddings
        if any(w in lower for w in ["vector", "embedding", "hnsw", "cosine", "similarity", "dimension", "rag"]):
            if experience_level == "beginner":
                reply = (
                    "In a vector database, words, sentences, or code are transformed into lists of numbers (embeddings) "
                    "that capture their true meaning rather than just exact keywords. Think of it like a 3D map where similar words "
                    "sit close together: 'king' and 'queen' sit in the royal district, while 'apple' and 'banana' sit in the fruit section.\n\n"
                    "Step 1: Text is converted into a list of numbers (e.g. 2048 numbers) by an embedding model.\n"
                    "Step 2: When you search, your query is also turned into numbers.\n"
                    "Step 3: The database calculates the geometric angle (cosine distance) to find the closest matches in the map."
                )
            elif experience_level == "advanced":
                reply = (
                    "Vector search in PostgreSQL using the pgvector extension stores high-dimensional dense floating-point arrays (such as 2048-dim vectors). "
                    "Rather than performing an O(N) exhaustive brute-force Euclidean calculation, an Approximate Nearest Neighbor (ANN) index like HNSW "
                    "(Hierarchical Navigable Small World) constructs multi-layered skip graphs. Traversal hops across sparse upper layers down to dense lower layers, "
                    "allowing cosine distance (`<=>`) queries to return top-k matches within single-digit milliseconds while preserving hybrid SQL filters (e.g., `WHERE user_id = $1`)."
                )
            else:  # intermediate
                reply = (
                    "A vector database indexes high-dimensional dense numeric arrays (embeddings) generated by models like Gemma or OpenAI. "
                    "Instead of standard B-Trees that only sort scalar values (like numbers or strings), vector search uses similarity metrics:\n"
                    "• Cosine Distance (`<=>`): Measures the angular difference between two direction vectors, independent of magnitude.\n"
                    "• HNSW Index: Traverses hierarchical navigable graph layers to avoid scanning every row on disk.\n"
                    "• Hybrid Queries: Allows combining relational metadata (`user_id = $1 AND verified = true`) with semantic similarity ranking in a single query."
                )
            socratic_q = "How does an HNSW index prevent high query latency as your table grows from 1,000 to 1,000,000 embedding records?"
            return reply, socratic_q, concept_anim, struggle_topic

        # 2. Relational Databases / PostgreSQL
        if any(w in lower for w in ["postgres", "sql", "index", "btree", "schema", "query", "explain"]):
            if experience_level == "beginner":
                reply = (
                    "Think of a database index like the index at the back of a 1,000-page book. Without the index, if you wanted to find every mention of 'PostgreSQL', "
                    "you would have to read every page one by one (a sequential scan). With an alphabetical index, you flip straight to the 'P' section in 3 quick hops!"
                )
            elif experience_level == "advanced":
                reply = (
                    "PostgreSQL's cost-based optimizer uses table statistics and catalog page counts to determine whether an index scan or bitmap heap scan beats a sequential scan. "
                    "A balanced B-Tree maintains O(log N) depth, transforming thousands of sequential disk block reads into 3-4 buffer hits in RAM, drastically reducing execution latency."
                )
            else:  # intermediate
                reply = (
                    "In relational database design, B-Tree indexes sort column values into balanced tree structures. "
                    "Instead of reading every record from disk sequentially (O(N)), the database traverses tree branches in O(log N) time. "
                    "Using `EXPLAIN ANALYZE` allows you to inspect whether the query planner chose an Index Scan or fell back to a costly Sequential Scan."
                )
            socratic_q = "Which column in your orders schema has the highest lookup frequency or appears most often in WHERE and JOIN filters?"
            return reply, socratic_q, concept_anim, struggle_topic

        # 3. API Testing & Boundaries
        if any(w in lower for w in ["api", "testing", "rest", "endpoint", "400", "401", "201", "boundary", "auth"]):
            if experience_level == "beginner":
                level_desc = (
                    "Think of an API like ordering food at a restaurant drive-through:\n"
                    "• Happy path (201/200): You ask for a valid burger combo, pay the right amount, and receive your packaged meal.\n"
                    "• Input error (400): You ask for item number 999 which does not exist, or ask for negative 3 burgers. The cashier immediately tells you what went wrong instead of crashing the kitchen.\n"
                    "• Security gate (401): You try to pick up food without paying or showing a receipt. You are politely stopped at the window."
                )
            elif experience_level == "advanced":
                level_desc = (
                    "In enterprise REST architectures, automated testing enforces strict contract schemas, idempotency invariants, and token lifecycle states:\n"
                    "• 201 Created: Asserts HTTP 201 with immutable resource UUIDs and transactional atomicity.\n"
                    "• 400 Bad Request: Validates that edge payloads (boundary overflows, malformed types, null bytes) fail fast at serializer serialization before executing DB transactions.\n"
                    "• 401/403 Security: Asserts that expired JWT signatures, tampered headers, or unauthorized RBAC scopes are intercepted by middleware prior to view execution."
                )
            else:  # intermediate
                level_desc = (
                    "Robust REST API testing follows defense-in-depth across three essential boundaries:\n"
                    "1. Happy Path: Verifies that valid JSON payloads return HTTP 201 Created along with the exact response schema.\n"
                    "2. Validation Boundary: Verifies that missing required fields or negative quantities return HTTP 400 Bad Request with field-level error messages.\n"
                    "3. Security Boundary: Verifies that unauthenticated or tampered requests immediately return HTTP 401 Unauthorized."
                )

            if learning_preference == "visual":
                style_addon = (
                    "\n\n[Client HTTP Request]\n"
                    "       │\n"
                    "       ▼\n"
                    "[Token Auth Guard] ──► Missing Token? ──► [HTTP 401 Unauthorized]\n"
                    "       │\n"
                    "       ▼\n"
                    "[Serializer Schema] ─► Malformed Body? ─► [HTTP 400 Bad Request]\n"
                    "       │\n"
                    "       ▼\n"
                    "[Service / DB ORM] ──► Valid Payload! ──► [HTTP 201 Created + JSON Body]"
                )
            elif learning_preference == "hands_on":
                style_addon = (
                    "\n\nTest Assertion Blueprint:\n"
                    "• assert response.status_code == 201\n"
                    "• assert 'order_id' in response.data\n"
                    "• assert response.data['status'] == 'pending'\n"
                    "• assert err_res.status_code == 400\n"
                    "• assert 'items' in err_res.data.get('errors', {})"
                )
            else:  # socratic
                style_addon = (
                    "\n\nArchitectural Trade-off:\n"
                    "Testing only HTTP status codes (e.g. assert status == 200) allows silent payload contract drift where "
                    "a breaking schema change passes tests unnoticed. Asserting specific dictionary keys and data types guarantees contract integrity."
                )

            reply = f"{level_desc}{style_addon}"
            socratic_q = "Why is asserting specific field keys in the response body more reliable than only checking the HTTP status code?"
            return reply, socratic_q, concept_anim, struggle_topic

        # 4. Docker & DevOps
        if any(w in lower for w in ["docker", "container", "devops", "image", "dockerfile"]):
            if experience_level == "beginner":
                level_desc = (
                    "Think of Docker like shipping standardized cargo containers:\n"
                    "Instead of loading loose items onto a ship and hoping they don't break, you pack the application, Python version, "
                    "and all libraries into a sealed box. It runs exactly the same on your laptop, a staging server, or AWS cloud!"
                )
            elif experience_level == "advanced":
                level_desc = (
                    "Docker containerization leverages Linux kernel namespaces (PID, NET, IPC, MNT, UTS) and control groups (cgroups v2) "
                    "for fine-grained resource constraints. Multi-stage builds decouple build-time compilation toolchains (gcc, musl-dev) from "
                    "the final scratch/distroless runtime, dropping image surface area and eliminating CVE exposure."
                )
            else:  # intermediate
                level_desc = (
                    "Containers provide lightweight isolation by sharing the host OS kernel rather than virtualizing guest hardware. "
                    "Key container best practices include:\n"
                    "• Multi-stage builds to produce minimal slim images.\n"
                    "• Switching from root to an unprivileged user (UID 1001) for security hardening.\n"
                    "• Adding periodic HEALTHCHECK probes to signal readiness to orchestrators."
                )

            if learning_preference == "visual":
                style_addon = (
                    "\n\n[Stage 1: Build Image] ──► Compiles dependencies with gcc & wheels\n"
                    "       │ (Copies only runtime wheels)\n"
                    "       ▼\n"
                    "[Stage 2: Slim Image]  ──► Minimal Python runtime (~80MB vs 1GB)\n"
                    "       │\n"
                    "       ▼\n"
                    "[USER appuser (1001)]  ──► Drops root privileges for secure production execution"
                )
            elif learning_preference == "hands_on":
                style_addon = (
                    "\n\nHardened Dockerfile Pattern:\n"
                    "FROM python:3.11-slim AS runtime\n"
                    "RUN useradd -u 1001 appuser\n"
                    "USER appuser\n"
                    "HEALTHCHECK --interval=30s CMD curl -f http://localhost:8000/health/ || exit 1"
                )
            else:
                style_addon = (
                    "\n\nSecurity Trade-off:\n"
                    "Running containers as the default root user allows container-breakout exploits to compromise the host kernel. "
                    "Enforcing a non-root UID restricts write permissions to ephemeral application mounts only."
                )

            reply = f"{level_desc}{style_addon}"
            socratic_q = "Why should production containers switch to an unprivileged non-root user instead of the default root account?"
            return reply, socratic_q, concept_anim, struggle_topic

        # 5. Cloud Pipelines (AWS / S3 / SQS)
        if any(w in lower for w in ["pipeline", "aws", "s3", "sqs", "lambda", "event", "cloud"]):
            if experience_level == "beginner":
                level_desc = (
                    "Think of cloud queues like a restaurant order ticket line:\n"
                    "When customers order, tickets are clipped to a wire line. Even if 100 people order at the same second, "
                    "the kitchen cooks them one by one without the front cashiers freezing or crashing."
                )
            elif experience_level == "advanced":
                level_desc = (
                    "Asynchronous decoupling with AWS S3, SQS FIFO, and auto-scaling Lambda workers eliminates synchronous backpressure. "
                    "Pre-signed URLs offload network I/O from API gateways directly to S3. Message visibility timeouts prevent duplicate "
                    "deliverable processing, while Dead-Letter Queues (DLQ) with redrive policies isolate poison-pill payloads without stalling the queue."
                )
            else:  # intermediate
                level_desc = (
                    "Decoupling systems with cloud message queues (like AWS SQS) prevents user-facing web servers from slowing down during heavy tasks.\n"
                    "• S3 stores large binary files and deliverable uploads.\n"
                    "• SQS buffers job messages to balance peak bursts.\n"
                    "• Worker processes pull and evaluate submissions asynchronously without losing messages."
                )

            if learning_preference == "visual":
                style_addon = (
                    "\n\n[Client Upload] ──► [Direct to S3 via Presigned URL]\n"
                    "                          │\n"
                    "                          ▼ (S3 Event)\n"
                    "                   [SQS Message Queue]\n"
                    "                          │\n"
                    "                          ▼ (Worker Pull)\n"
                    "              [Background Evaluation Worker] ──► [Results to DB]"
                )
            elif learning_preference == "hands_on":
                style_addon = (
                    "\n\nQueue Consumer Pattern:\n"
                    "• response = sqs.receive_message(QueueUrl=url, MaxNumberOfMessages=1, VisibilityTimeout=60)\n"
                    "• Process message payload within timeout\n"
                    "• sqs.delete_message(QueueUrl=url, ReceiptHandle=handle)"
                )
            else:
                style_addon = (
                    "\n\nDecoupling Trade-off:\n"
                    "Synchronous HTTP processing ties up web worker threads for 5-30 seconds during evaluations, leading to 504 timeouts. "
                    "Queue-based asynchronous processing ensures 100% submission capture with zero server drop-offs."
                )

            reply = f"{level_desc}{style_addon}"
            socratic_q = "What is the benefit of a Dead-Letter Queue (DLQ) when a deliverable file repeatedly fails worker parsing?"
            return reply, socratic_q, concept_anim, struggle_topic

        # 6. Django REST Framework & Web APIs
        if any(w in lower for w in ["drf", "django rest", "rest framework", "serializer", "viewset"]):
            if experience_level == "beginner":
                level_desc = (
                    "In Django REST Framework, the most common issues come from misunderstandings between serializers and models:\n"
                    "• N+1 Queries: The API executes 1 query for the parent list, and then 100 extra queries for each related item.\n"
                    "• Nullable Fields: A model field allows null (`null=True`), but the serializer rejects empty inputs (`allow_null=False`).\n"
                    "• Permissions: Writing custom endpoints without checking object-level permissions."
                )
            elif experience_level == "advanced":
                level_desc = (
                    "High-throughput DRF production incidents typically trace back to ORM and lifecycle boundaries:\n"
                    "• Prefetch Invalidation: Slicing or filtering related models inside a `SerializerMethodField` invalidates `prefetch_related` caches.\n"
                    "• Object-Permission Bypass: Calling `Model.objects.get(pk=id)` in custom `@action` methods bypasses `has_object_permission()`.\n"
                    "• Non-deterministic Pagination: Paginating querysets without an explicit, unique secondary sort key causes duplicate or skipped records.\n"
                    "• Concurrency TOCTOU: Validating uniqueness in `serializer.validate()` instead of relying on database constraints inside `transaction.atomic()`."
                )
            else:  # intermediate
                level_desc = (
                    "The most frequent production bugs in Django REST Framework (DRF) include:\n"
                    "1. N+1 Query Storms: Omitting `select_related()` (for ForeignKey) or `prefetch_related()` (for ManyToMany/ReverseFK) in the view queryset.\n"
                    "2. `allow_null` vs `null=True`: Serializer fields default to `allow_null=False`, causing 400 Bad Request errors even if the DB model allows nulls.\n"
                    "3. Object Permission Gaps: Bypassing `self.get_object()` in custom viewset actions leaves endpoints vulnerable to unauthorized tenant access.\n"
                    "4. Partial Update Mutations: Using `partial=True` ignores missing fields, but sending `null` actively wipes data unless explicitly guarded."
                )

            if learning_preference == "visual":
                style_addon = (
                    "\n\n[Client HTTP Request]\n"
                    "       │\n"
                    "       ▼\n"
                    "[URL Routing & Auth] ──► Token Invalid? ──► [401 Unauthorized]\n"
                    "       │\n"
                    "       ▼\n"
                    "[Serializer.is_valid()] ─► Schema Mismatch? ─► [400 Bad Request]\n"
                    "       │\n"
                    "       ▼\n"
                    "[View Logic / ORM] ──► Missing select_related? ──► [N+1 DB Query Bottleneck]\n"
                    "       │\n"
                    "       ▼\n"
                    "[JSON Response Output]"
                )
            elif learning_preference == "hands_on":
                style_addon = (
                    "\n\nDefensive DRF ViewSet Pattern:\n"
                    "```python\n"
                    "class OrderViewSet(viewsets.ModelViewSet):\n"
                    "    queryset = Order.objects.select_related('customer').prefetch_related('items').order_by('-created_at', '-id')\n"
                    "    permission_classes = [IsAuthenticated, IsOrderOwner]\n"
                    "\n"
                    "    def get_object(self):\n"
                    "        obj = super().get_object()\n"
                    "        self.check_object_permissions(self.request, obj)\n"
                    "        return obj\n"
                    "```"
                )
            else:
                style_addon = (
                    "\n\nArchitectural Analysis:\n"
                    "Why does performing uniqueness validation in `serializer.validate()` introduce a Time-of-Check to Time-of-Use (TOCTOU) race condition in concurrent environments?"
                )

            reply = f"{level_desc}{style_addon}"
            socratic_q = "In your DRF serializers, how do you verify whether a nested relation triggers an N+1 query storm during list serialization?"
            return reply, socratic_q, concept_anim, struggle_topic

        # 7. Python Core, Concurrency & Production Edge Cases
        if any(w in lower for w in ["python", "gil", "asyncio", "generator", "mutable", "leak", "multithread"]):
            if experience_level == "beginner":
                level_desc = (
                    "In Python, the most common bugs encountered in production include:\n"
                    "• Mutable Default Arguments: Defining `def add_item(item, target=[])` causes all calls to share the exact same list in memory.\n"
                    "• Variable Scoping & Closures: Late binding in loops (`[lambda: i for i in range(5)]`) evaluates all functions to the final value.\n"
                    "• Silent Exception Swallowing: Using bare `except:` blocks catches critical system signals like `KeyboardInterrupt` and hides real crashes."
                )
            elif experience_level == "advanced":
                level_desc = (
                    "Advanced Python production incidents typically manifest around concurrency, memory layout, and runtime mechanics:\n"
                    "• GIL CPU Contention: Multi-threading CPU-bound tasks actually increases wall-clock time due to Global Interpreter Lock thread contention.\n"
                    "• AsyncIO Event Loop Starvation: Calling blocking synchronous I/O or CPU-intensive routines inside coroutines halts the entire event loop.\n"
                    "• Cyclic Garbage Collection Delays: Circular references between objects prevent immediate reference-counting deallocation, causing RSS memory spikes until full generation-2 GC cycles run.\n"
                    "• Exception Context Masking: Re-raising exceptions with `raise CustomError()` destroys the root cause traceback unless `raise CustomError() from err` is used."
                )
            else:  # intermediate
                level_desc = (
                    "The most frequent production bugs and edge cases encountered in Python include:\n"
                    "1. Mutable Default Arguments: `def append_to(element, to=[])` binds `to` once at function definition time, mutating shared state across requests.\n"
                    "2. Event Loop Blocking in AsyncIO: Running synchronous database drivers or `requests.get()` inside async handlers blocks all concurrent tasks.\n"
                    "3. Late-Binding Closures: Functions defined inside a loop bind variables by reference, not value, causing every function to inspect the loop's final state.\n"
                    "4. Generator Exhaustion: Passing a generator or `map()` iterator to multiple consumers works on the first pass, but silently yields empty results on subsequent passes."
                )

            if learning_preference == "visual":
                style_addon = (
                    "\n\n[Python Call / Coroutine]\n"
                    "            │\n"
                    "            ▼\n"
                    "[Memory Allocation] ──► Mutable Default Arg? ──► [Shared Object State Bug]\n"
                    "            │\n"
                    "            ▼\n"
                    "[Execution Engine]  ──► Blocking I/O in Async? ──► [Event Loop Freezes / Latency Spike]\n"
                    "            │\n"
                    "            ▼\n"
                    "[Exception Handler] ──► Bare except / no 'from'? ─► [Lost Root-Cause Traceback]\n"
                    "            │\n"
                    "            ▼\n"
                    "[Garbage Collector] ──► Cyclic References? ────► [Delayed Deallocation / RSS Spike]"
                )
            elif learning_preference == "hands_on":
                style_addon = (
                    "\n\nDefensive Python Patterns:\n"
                    "```python\n"
                    "# 1. Immutable default argument pattern\n"
                    "def fetch_records(query: str, filters: list[str] | None = None) -> list[dict]:\n"
                    "    filters = list(filters) if filters is not None else []\n"
                    "    ...\n"
                    "\n"
                    "# 2. Explicit exception chaining\n"
                    "try:\n"
                    "    data = json.loads(payload)\n"
                    "except json.JSONDecodeError as err:\n"
                    "    raise ValidationError('Malformed payload') from err\n"
                    "```"
                )
            else:
                style_addon = (
                    "\n\nArchitectural Analysis:\n"
                    "How does the difference between CPython's reference counting and cyclic generational garbage collection influence how and when memory is reclaimed in long-running services?"
                )

            reply = f"{level_desc}{style_addon}"
            socratic_q = "In your Python code, how do you ensure that long-running async tasks or background workers do not leak memory through circular references or module-level singletons?"
            return reply, socratic_q, concept_anim, struggle_topic

        # 8. General Skill Invariant
        if experience_level == "beginner":
            level_desc = (
                f"When working on {skill_name}, the best way to start is by breaking the challenge down into simple steps:\n"
                "1. What is the goal? (What should happen when everything works?)\n"
                "2. What could go wrong? (What if an empty or invalid value is provided?)\n"
                "3. How do we test it? (How can we prove it works reliably?)"
            )
        elif experience_level == "advanced":
            level_desc = (
                f"Mastering {skill_name} requires treating the deliverable as a production micro-service with deterministic contracts, "
                "fault isolation, and sub-millisecond efficiency. Consider memory allocations, transaction boundaries, and defensive assertions."
            )
        else:  # intermediate
            level_desc = (
                f"In professional software engineering, {skill_name} requires clean separation of concerns:\n"
                "• Establish clear data contracts and types.\n"
                "• Validate input assumptions at the perimeter before mutating state.\n"
                "• Handle edge cases with deterministic error responses."
            )

        if learning_preference == "visual":
            style_addon = (
                f"\n\n[Input Contract] ──► [{skill_name} Gateway Guard] ──► [Core Logic & State] ──► [Verified Output]"
            )
        elif learning_preference == "hands_on":
            style_addon = (
                f"\n\nPractical Deliverable Check:\n"
                f"• Verify {skill_name} boundary conditions\n"
                f"• Assert deterministic responses for valid & invalid inputs\n"
                f"• Verify schema integrity and error propagation"
            )
        else:
            style_addon = (
                f"\n\nDiagnostic Insight: What invariant in {skill_name} must hold true across every single execution path?"
            )

        reply = f"{level_desc}{style_addon}"
        socratic_q = f"In your {skill_name} implementation, what key condition or input validation protects the system against unexpected errors?"
        return reply, socratic_q, concept_anim, struggle_topic
