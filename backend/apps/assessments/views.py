import re
import json
import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import AssessmentTask, AssessmentSubmission, MicroLessonProgress
from .serializers import AssessmentTaskSerializer, AssessmentSubmissionSerializer, MicroLessonProgressSerializer
from .evaluator import RubricEvaluator

logger = logging.getLogger(__name__)

class AssessmentDetailView(APIView):
    """
    GET /api/assessments/{task_id}/
    Retrieves task instructions, rubric definition, and target skill,
    and returns the learner's previous submission if one exists so they can refer to it later.
    """
    permission_classes = [AllowAny]
    def get(self, request, task_id):
        user_id = request.query_params.get("user_id", "usr_demo_001")
        target_skill = request.query_params.get("target_skill")

        task = AssessmentTask.objects.filter(task_id=task_id).first()
        if not task and target_skill:
            task = AssessmentTask.objects.filter(target_skill__iexact=target_skill).first()

        if not task:
            from .evaluator import RubricEvaluator
            evaluator = RubricEvaluator()
            rubric_specs = evaluator.get_rubric_for_skill(target_skill or "API Testing")
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
                rubric=rubric_specs
            )
        elif not task.rubric or len(task.rubric) < 4:
            from .evaluator import RubricEvaluator
            evaluator = RubricEvaluator()
            task.rubric = evaluator.get_rubric_for_skill(task.target_skill)
            task.save(update_fields=["rubric"])

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
    permission_classes = [AllowAny]
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
    permission_classes = [AllowAny]
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
    permission_classes = [AllowAny]
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

        # 1. Security & Edge Case Defense: System prompt, credential leaks, and adversarial prompt injections
        from services.domain_guard_service import DomainGuardService
        guard_res = DomainGuardService.evaluate_input_safety_and_domain(message, skill_name)

        secret_leak_indicators = [
            "system prompt", "system instruction", "reveal prompt", "ignore previous instructions",
            "api_key", "apikey", "secret_key", "secret key", "database_url", "aws_secret",
            "openrouter_api_key", "env var", "environment variable", "credentials", "auth token"
        ]
        if not guard_res.get("is_safe") or any(sec in lower for sec in secret_leak_indicators):
            reply = (
                f"I am your dedicated SkillBridge Engineering Mentor for {skill_name}. My role is to help you "
                "master software engineering concepts, understand architectural trade-offs, and pass your practical deliverables. "
                "I cannot disclose internal system prompts, tokens, or execute adversarial prompt overrides. "
                f"Let's stay focused on mastering {skill_name} and building production-ready deliverables!"
            )
            socratic_q = f"What specific architectural question can I help guide you on regarding {skill_name}?"
            return reply, socratic_q, None, None, "system_guard", "Security Guardrail"

        # 2. Out-of-Context Boundary Filter: Gracefully deflect unrelated off-topic inquiries
        unrelated_indicators = [
            "recipe", "cooking", "cake", "bake", "pizza", "dinner", "burger", "pasta", "dessert",
            "celebrity", "hollywood", "actor", "actress", "horoscope", "astrology", "zodiac",
            "poem about", "write a song", "lyrics", "football score", "basketball", "soccer",
            "presidential election", "politics", "political", "medical diagnosis", "symptoms", "prescription",
            "cryptocurrency trading", "stock price prediction", "invest in crypto", "legal advice", "lawsuit", "movie review"
        ]
        if any(u in lower for u in unrelated_indicators) or (not guard_res.get("is_tech_domain") and guard_res.get("status") == "domain_in_development"):
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

        # 1. TypeScript / JavaScript / Frontend / Fullstack
        if any(w in combined for w in ["typescript", "ts", "javascript", "zod", "z.infer", "interface", "type check", "transpil", "ast", "type erasure"]):
            if any(w in combined for w in ["zod", "z.infer", "validation", "schema", "safeparse", "boundary", "parse"]):
                return {
                    "type": "custom_pipeline",
                    "title": f"Interactive Concept Animation: {skill_name} Runtime Schema Validation & Type Inference",
                    "description": "Watch how untrusted client payloads are verified at runtime via Zod schemas without sacrificing TypeScript compile-time type safety.",
                    "nodes": [
                        {"id": "n1", "name": "Raw Client Payload", "detail": "Untrusted JSON Network Packet", "icon": "Code", "status_text": "Unverified shape"},
                        {"id": "n2", "name": "Zod Schema (z.infer)", "detail": "Runtime Type Inference Definition", "icon": "Layers", "status_text": "Evaluating shape"},
                        {"id": "n3", "name": "safeParse() Perimeter", "detail": "Non-throwing Boundary Guard", "icon": "ShieldCheck", "status_text": "Strict validation"},
                        {"id": "n4", "name": "Type-Safe Domain Handler", "detail": "Guaranteed Clean Model Entity", "icon": "CheckCircle2", "status_text": "100% Type-Sound"}
                    ],
                    "steps": [
                        "Step 1: Client submits raw untrusted JSON payload over the HTTP network boundary.",
                        "Step 2: Zod schema (z.infer<typeof Schema>) dynamically infers compile-time TypeScript types from runtime schema contracts.",
                        "Step 3: safeParse() tests input fields, formats, and non-empty constraints without throwing unhandled exceptions.",
                        "Step 4: Business logic controller receives guaranteed type-safe domain entities, eliminating runtime TypeError bugs."
                    ]
                }
            return {
                "type": "custom_pipeline",
                "title": f"Interactive Concept Animation: {skill_name} Execution & Transpilation Flow",
                "description": "Watch how TypeScript source code undergoes static AST analysis and type erasure to produce an optimized JavaScript runtime bundle.",
                "nodes": [
                    {"id": "n1", "name": "Source Code (.ts)", "detail": "Interface & Generic Contracts", "icon": "Code", "status_text": "Strict mode"},
                    {"id": "n2", "name": "AST & Type Checker", "detail": "Compile-time Type Guard", "icon": "ShieldCheck", "status_text": "Proving types"},
                    {"id": "n3", "name": "Transpiler (tsc)", "detail": "Type Erasure & AST Node Lowering", "icon": "Cpu", "status_text": "Erasing types"},
                    {"id": "n4", "name": "Production Bundle (.js)", "detail": "Zero Runtime Overhead", "icon": "CheckCircle2", "status_text": "V8 Optimized"}
                ],
                "steps": [
                    "Step 1: Developer writes strict TypeScript code with types, interfaces, and generics.",
                    "Step 2: TypeScript type checker builds Abstract Syntax Tree and proves type soundness before execution.",
                    "Step 3: Transpiler strips type annotations entirely (type erasure), emitting standard ECMAScript.",
                    "Step 4: Node.js V8 engine executes lightweight JavaScript with zero runtime memory penalty."
                ]
            }

        # 2. Machine Learning / PyTorch / Deep Learning
        elif domain == "ml_ai" or any(w in combined for w in ["pytorch", "torch", "tensor", "gradient", "autograd", "loss", "backprop", "neural", "deep learning"]):
            return {
                "type": "custom_pipeline",
                "title": f"Interactive Deep Learning Flow: {skill_name} Forward & Backward Pass",
                "description": "Visualize how batch tensors propagate forward through layers, calculate loss, and update weights via Autograd.",
                "nodes": [
                    {"id": "n1", "name": "Batch DataLoader", "detail": "Pinned host memory tensor batches", "icon": "Layers", "status_text": "shape [B, D]"},
                    {"id": "n2", "name": "Forward Pass (CUDA)", "detail": "Layer transformations & activations", "icon": "Cpu", "status_text": "Logits output"},
                    {"id": "n3", "name": "Loss & Autograd ∇W", "detail": "loss.item() graph detachment", "icon": "GitBranch", "status_text": "Backward pass"},
                    {"id": "n4", "name": "Optimizer Update", "detail": "Weight adjustment & zero_grad()", "icon": "CheckCircle2", "status_text": "Loss converged"}
                ],
                "steps": [
                    "Step 1: DataLoader prepares batch tensors [B, In_Features] and transfers them to the compute device.",
                    "Step 2: Input propagates through nn.Module layers and activation functions to compute prediction logits.",
                    "Step 3: Criterion evaluates scalar penalty against ground truth labels; loss.item() detaches graph to prevent CUDA leaks.",
                    "Step 4: Autograd computes gradient DAG (loss.backward()), optimizer updates weights, and zero_grad() clears buffers."
                ]
            }

        # 3. Vector Search & RAG
        elif any(w in combined for w in ["vector", "embedding", "hnsw", "cosine", "nearest neighbor", "distance"]):
            return {
                "type": "custom_pipeline",
                "title": f"Interactive Vector Search: 2048-Dim Embedding & HNSW Cosine Distance",
                "description": "Watch how a query vector traverses the HNSW graph to find nearest neighbors in sub-millisecond time.",
                "nodes": [
                    {"id": "n1", "name": "Raw Query Tokenizer", "detail": "Text chunking & token encoding", "icon": "Code", "status_text": "Tokens ready"},
                    {"id": "n2", "name": "Embedding Model", "detail": "Transforms tokens into 2048-dim vector", "icon": "Cpu", "status_text": "Unit vector [2048]"},
                    {"id": "n3", "name": "HNSW Graph Traversal", "detail": "Hierarchical multi-layer graph hop", "icon": "GitBranch", "status_text": "Sub-millisecond seek"},
                    {"id": "n4", "name": "Cosine Ranker", "detail": "Computes (1 - cos θ) nearest neighbors", "icon": "CheckCircle2", "status_text": "Top-K Matches"}
                ],
                "steps": [
                    "Step 1: User query string is tokenized and sanitized into context chunks.",
                    "Step 2: Dense embedding model maps semantic query into normalized 2048-dimensional vector space.",
                    "Step 3: HNSW index performs logarithmic graph hops across sparse layers to isolate nearest neighbor clusters.",
                    "Step 4: Cosine distance ranking retrieves top-K semantic document chunks in under 5ms."
                ]
            }

        # 4. Relational Databases & Indexing (PostgreSQL / SQL)
        elif any(w in combined for w in ["index", "btree", "b-tree", "performance", "slow", "fast", "scan", "lookup", "speed", "cardinality", "postgres", "sql"]):
            return {
                "type": "custom_pipeline",
                "title": f"Interactive Concept Animation: {skill_name} B-Tree Index Traversal vs Scan",
                "description": "See how B-Tree index pointers eliminate disk I/O by navigating logarithmic tree branches.",
                "nodes": [
                    {"id": "n1", "name": "Connection Pool", "detail": "pgbouncer connection checkout", "icon": "Database", "status_text": "Active session"},
                    {"id": "n2", "name": "Query Planner", "detail": "Cost estimation & index selection", "icon": "Cpu", "status_text": "Index scan chosen"},
                    {"id": "n3", "name": "B-Tree Branch Hop", "detail": "Logarithmic tree descent O(log N)", "icon": "GitBranch", "status_text": "Direct leaf seek"},
                    {"id": "n4", "name": "WAL & ACID Commit", "detail": "Tuple retrieval with zero full-table I/O", "icon": "CheckCircle2", "status_text": "1.4ms Latency"}
                ],
                "steps": [
                    "Step 1: Client queries database through managed connection pool with parameterized query.",
                    "Step 2: PostgreSQL query optimizer analyzes column statistics and selects B-Tree index scan over sequential scan.",
                    "Step 3: Query engine descends root-to-leaf index blocks in 3 memory hops, bypassing 1M table rows.",
                    "Step 4: Target row tuple is fetched directly from heap memory with zero disk bottleneck."
                ]
            }

        # 5. Concurrency / Transactions / Locks
        elif any(w in combined for w in ["concurrent", "race", "lock", "conflict", "deadlock", "acid", "transaction", "mutex", "isolation"]):
            return {
                "type": "custom_pipeline",
                "title": f"Interactive Concept Animation: {skill_name} Concurrency, Mutex & Row Locks",
                "description": "Visualize what happens when two threads hit conflicting state at the exact same millisecond.",
                "nodes": [
                    {"id": "n1", "name": "Parallel Invocations", "detail": "Two requests hit shared row at 00:00.001", "icon": "User", "status_text": "Concurrent clash"},
                    {"id": "n2", "name": "Row Lock Perimeter", "detail": "SELECT ... FOR UPDATE serializes access", "icon": "ShieldCheck", "status_text": "Thread A Lock Held"},
                    {"id": "n3", "name": "Mutex Wait Boundary", "detail": "Thread B safely queued; no dirty read", "icon": "Layers", "status_text": "Safely isolated"},
                    {"id": "n4", "name": "Atomic Commit", "detail": "Thread A commits; Thread B resumes cleanly", "icon": "CheckCircle2", "status_text": "Zero Race Conditions"}
                ],
                "steps": [
                    "Step 1: Two client requests execute concurrent mutations against the exact same record simultaneously.",
                    "Step 2: Thread A acquires an exclusive row lock via SELECT ... FOR UPDATE within a transaction.",
                    "Step 3: Thread B is held at the mutex boundary, preventing lost updates and dirty reads.",
                    "Step 4: Thread A commits changes atomically; Thread B resumes against clean, consistent state."
                ]
            }

        # 6. Cloud & Event Pipelines (AWS / S3 / SQS / Docker)
        elif any(w in combined for w in ["pipeline", "aws", "s3", "sqs", "lambda", "queue", "event", "cloud", "async", "worker", "docker", "container"]):
            return {
                "type": "custom_pipeline",
                "title": f"Interactive Concept Animation: {skill_name} Cloud & Event-Driven Pipeline",
                "description": f"Track how tasks are validated, enqueued, and processed reliably in {skill_name}.",
                "nodes": [
                    {"id": "n1", "name": "Ingress Gateway", "detail": "Client payload submission & signature", "icon": "Server", "status_text": "Received"},
                    {"id": "n2", "name": "Asynchronous Queue", "detail": "Decoupled buffer & at-least-once delivery", "icon": "Layers", "status_text": "Enqueued"},
                    {"id": "n3", "name": "Worker Sandbox", "detail": "Isolated processing & security check", "icon": "Cpu", "status_text": "Processing"},
                    {"id": "n4", "name": "Persisted State", "detail": "Durable asset storage & event ack", "icon": "CheckCircle2", "status_text": "Complete"}
                ],
                "steps": [
                    f"Step 1: Ingress gateway validates caller signature and accepts {skill_name} deliverable payload.",
                    "Step 2: Event is serialized into a durable queue buffer, insulating downstream workers from spikes.",
                    f"Step 3: Worker daemon pulls job, applies security isolation, and executes {skill_name} task logic.",
                    "Step 4: Output is persisted to durable object storage and completion event is emitted."
                ]
            }

        # 7. Dynamic Universal Context Pipeline (covers any other skill)
        else:
            return {
                "type": "custom_pipeline",
                "title": f"Interactive Concept Animation: {skill_name} Execution Pipeline",
                "description": f"Visual walkthrough of input contract verification, perimeter guards, and domain execution for {skill_name}.",
                "nodes": [
                    {"id": "n1", "name": "Input Contract", "detail": f"Inbound {skill_name} schema payload", "icon": "Code", "status_text": "Packet Ingress"},
                    {"id": "n2", "name": "Perimeter Guard", "detail": "Validation & sanitization checks", "icon": "ShieldCheck", "status_text": "Validating"},
                    {"id": "n3", "name": "Core Logic Engine", "detail": f"Domain mutations & {skill_name} service", "icon": "Cpu", "status_text": "Executing"},
                    {"id": "n4", "name": "Persisted Output", "detail": "Verified output contracts & persistence", "icon": "CheckCircle2", "status_text": "Committed"}
                ],
                "steps": [
                    f"Step 1: Input payload reaches the {skill_name} service boundary.",
                    f"Step 2: Perimeter guard validates schemas, constraints, and credentials before processing.",
                    f"Step 3: Core {skill_name} business logic executes operations against application state.",
                    "Step 4: Final response passes contract assertions and state is safely persisted."
                ]
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


class DynamicSyllabusGeneratorView(APIView):
    """
    POST /api/assessments/generate-syllabus/
    Generates dynamic, personalized practical task divisions, rubric criteria,
    and contextual concept animations using GeminiService.
    Customizes by skill, target role, project deliverables, and experience level.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        skill_name = request.data.get("skill_name") or "TypeScript"
        target_role = request.data.get("target_role") or "Junior Backend Developer"
        project_title = request.data.get("project_title") or f"{skill_name} Practical Engineering Deliverable"
        target_deliverables = request.data.get("target_deliverables") or []
        experience_level = request.data.get("experience_level") or "intermediate"
        learning_preference = request.data.get("learning_preference") or "visual"

        # 1. Try Live AI Generation via GeminiService
        try:
            from services.gemini_service import GeminiService
            gemini = GeminiService()
            if gemini.is_configured():
                prompt = (
                    f"You are a Principal Software Engineer designing a personalized practical assessment syllabus, 5-division rubrics, and conceptual animation for an engineer.\n"
                    f"Skill: {skill_name}\n"
                    f"Target Role: {target_role}\n"
                    f"Project Title: {project_title}\n"
                    f"Target Deliverables: {target_deliverables}\n"
                    f"Experience Level: {experience_level}\n"
                    f"Learning Style: {learning_preference}\n\n"
                    f"Generate a customized 5-step task syllabus and 5-criterion rubric that directly matches these target deliverables and role.\n"
                    f"Also generate an interactive concept animation with 4 nodes that visualizes how {skill_name} actually executes in this project.\n"
                    f"Respond ONLY with valid JSON with keys: title, skill_name, experience_level, syllabus_steps, rubric, concept_animation.\n"
                    f"Each syllabus_step MUST have: step_number (1-5), field_key ('valid_test', 'invalid_test', 'auth_test', 'assertions', 'explanation'), "
                    f"title, subtitle, target_file, points, starter_code.\n"
                    f"Each rubric item MUST have: id (e.g. 'c1'), name (e.g. '1. Core Architecture'), pts (integer points e.g. 2), desc (description of verification).\n"
                    f"concept_animation MUST have: type ('custom_pipeline'), title, description, nodes (array of 4 objects with id, name, detail, icon, status_text), steps (array of 4 descriptive strings)."
                )
                ai_res = gemini.generate_text(prompt, temperature=0.2, max_tokens=2500)
                if ai_res.get("success") and ai_res.get("text"):
                    text = ai_res["text"].strip()
                    if "```json" in text:
                        text = text.split("```json")[1].split("```")[0].strip()
                    elif "```" in text:
                        text = text.split("```")[1].split("```")[0].strip()
                    parsed = json.loads(text)
                    if "syllabus_steps" in parsed and "rubric" in parsed:
                        normalized_rubric = []
                        for idx, r in enumerate(parsed.get("rubric", [])):
                            name = r.get("name") or r.get("criterion") or r.get("title") or r.get("criterion_name") or f"Criterion {idx+1}"
                            pts = r.get("pts") or r.get("points") or r.get("score") or r.get("max_points") or 2
                            desc = r.get("desc") or r.get("description") or r.get("detail") or f"Evaluates practical implementation of {name}."
                            normalized_rubric.append({
                                "id": r.get("id") or f"c{idx+1}",
                                "name": name,
                                "pts": int(pts) if str(pts).isdigit() else 2,
                                "desc": desc
                            })
                        parsed["rubric"] = normalized_rubric
                        # Persist dynamically synthesized rubric to AssessmentTask in PostgreSQL
                        try:
                            from django.utils.text import slugify
                            AssessmentTask.objects.update_or_create(
                                target_skill=skill_name,
                                defaults={
                                    "task_id": f"task_{slugify(skill_name) or 'dynamic'}",
                                    "title": f"Practical Technical Assessment: {skill_name}",
                                    "task_type": "technical_assessment",
                                    "total_points": 10,
                                    "instructions": f"Implement practical deliverable for {skill_name}.",
                                    "rubric": normalized_rubric
                                }
                            )
                        except Exception as cache_err:
                            logger.warning(f"Could not cache syllabus rubric to DB: {cache_err}")
                        return Response(parsed)
        except Exception as e:
            logger.warning("Dynamic syllabus Gemini generation fallback: %s", e)

        # 2. Rich Domain-Tailored Fallback
        result = self._get_tailored_syllabus(
            skill_name=skill_name,
            target_role=target_role,
            project_title=project_title,
            target_deliverables=target_deliverables,
            experience_level=experience_level,
            learning_preference=learning_preference
        )
        try:
            from django.utils.text import slugify
            if result.get("rubric"):
                AssessmentTask.objects.update_or_create(
                    target_skill=skill_name,
                    defaults={
                        "task_id": f"task_{slugify(skill_name) or 'dynamic'}",
                        "title": f"Practical Technical Assessment: {skill_name}",
                        "task_type": "technical_assessment",
                        "total_points": 10,
                        "instructions": f"Implement practical deliverable for {skill_name}.",
                        "rubric": result["rubric"]
                    }
                )
        except Exception:
            pass
        return Response(result)

    def _get_tailored_syllabus(self, skill_name: str, target_role: str, project_title: str, target_deliverables: list, experience_level: str, learning_preference: str):
        lower = skill_name.lower().strip()

        # TypeScript Project Specific
        if "typescript" in lower or "ts" in lower:
            f1 = target_deliverables[0] if len(target_deliverables) > 0 else "src/models/task.ts"
            f2 = target_deliverables[1] if len(target_deliverables) > 1 else "src/controllers/taskController.ts"
            f3 = target_deliverables[2] if len(target_deliverables) > 2 else "src/routes/taskRoutes.ts"
            return {
                "title": project_title or "Type-Safe Task Management REST API",
                "skill_name": skill_name,
                "experience_level": experience_level,
                "syllabus_steps": [
                    {
                        "step_number": 1,
                        "field_key": "valid_test",
                        "title": "Data Contracts & Runtime Schema Guard",
                        "subtitle": f"Define static types and runtime validation in {f1}",
                        "target_file": f1,
                        "points": 2,
                        "starter_code": f"/**\n * {f1}\n * TypeScript data contracts with strict runtime schema.\n */\nimport {{ z }} from 'zod';\n\nexport const TaskSchema = z.object({{\n  id: z.string().uuid(),\n  title: z.string().min(1, 'Title is required'),\n  completed: z.boolean().default(false),\n}});\n\nexport type Task = z.infer<typeof TaskSchema>;\n"
                    },
                    {
                        "step_number": 2,
                        "field_key": "invalid_test",
                        "title": "Controller Business Logic & Boundary Handlers",
                        "subtitle": f"Implement CRUD operations and typed error handling in {f2}",
                        "target_file": f2,
                        "points": 2,
                        "starter_code": f"/**\n * {f2}\n * Type-safe controller handling state transitions and boundary exceptions.\n */\nimport {{ Request, Response }} from 'express';\nimport {{ TaskSchema, Task }} from '../models/task';\n\nexport class TaskController {{\n  async createTask(req: Request, res: Response): Promise<Response> {{\n    const parsed = TaskSchema.safeParse(req.body);\n    if (!parsed.success) {{\n      return res.status(400).json({{ error: parsed.error.format() }});\n    }}\n    return res.status(201).json(parsed.data);\n  }}\n}}\n"
                    },
                    {
                        "step_number": 3,
                        "field_key": "auth_test",
                        "title": "Route Middleware & Security Typing",
                        "subtitle": f"Mount Express routes with typed parameter guards in {f3}",
                        "target_file": f3,
                        "points": 3,
                        "starter_code": f"/**\n * {f3}\n * Route definitions and typed request middleware.\n */\nimport {{ Router }} from 'express';\nimport {{ TaskController }} from '../controllers/taskController';\n\nconst router = Router();\nconst controller = new TaskController();\n\nrouter.post('/tasks', controller.createTask);\nexport default router;\n"
                    },
                    {
                        "step_number": 4,
                        "field_key": "assertions",
                        "title": "Type Soundness & Integration Assertions",
                        "subtitle": "Write Supertest/Jest assertions verifying contract schemas and zero type leaks",
                        "target_file": "tests/task.spec.ts",
                        "points": 2,
                        "starter_code": "// Integration test verifying status codes and schema contracts\nimport request from 'supertest';\nimport app from '../src/app';\n\ndescribe('Task REST API Contract', () => {\n  it('rejects malformed payload with 400', async () => {\n    const res = await request(app).post('/tasks').send({});\n    expect(res.status).toBe(400);\n  });\n});\n"
                    },
                    {
                        "step_number": 5,
                        "field_key": "explanation",
                        "title": "Architecture & Type-System Trade-Offs",
                        "subtitle": "Explain compile-time vs runtime guarantees, AST erasure, and memory trade-offs",
                        "target_file": "ARCHITECTURE.md",
                        "points": 1,
                        "starter_code": "Explain how TypeScript static types combined with Zod runtime boundary validation guarantee contract integrity without V8 engine runtime performance penalties."
                    }
                ],
                "rubric": [
                    {"id": "c1", "name": "1. Data Contracts & Static Typing", "pts": 2, "desc": f"Validates strict interface definitions and schema contracts in {f1}."},
                    {"id": "c2", "name": "2. Business Logic & Boundary Guards", "pts": 2, "desc": f"Handles edge cases, safeParse, and exception safety in {f2}."},
                    {"id": "c3", "name": "3. Route Middleware & Security", "pts": 3, "desc": f"Enforces authorization and typed routing in {f3}."},
                    {"id": "c4", "name": "4. Integration Contract Assertions", "pts": 2, "desc": "Verifies API responses, status codes, and payload shapes."},
                    {"id": "c5", "name": "5. Type Erasure & Architectural Rationale", "pts": 1, "desc": "Explains compile-time guarantees and runtime performance."}
                ],
                "concept_animation": {
                    "type": "custom_pipeline",
                    "title": "Interactive Concept Animation: TypeScript Execution & Transpilation Flow",
                    "description": "Watch how TypeScript source code undergoes static AST analysis and type erasure to produce an optimized JavaScript runtime bundle.",
                    "nodes": [
                        {"id": "n1", "name": "Source Code (.ts)", "detail": "Interface & Generic Contracts", "icon": "Code", "status_text": "Strict mode"},
                        {"id": "n2", "name": "AST & Type Checker", "detail": "Compile-time Type Guard", "icon": "ShieldCheck", "status_text": "Validating types"},
                        {"id": "n3", "name": "Transpiler (tsc)", "detail": "AST Node Lowering", "icon": "Cpu", "status_text": "Erasing types"},
                        {"id": "n4", "name": "Production Bundle (.js)", "detail": "Zero Runtime Overhead", "icon": "CheckCircle2", "status_text": "V8 Optimized"}
                    ],
                    "steps": [
                        "Step 1: Developer writes strict TypeScript code with types, interfaces, and generics.",
                        "Step 2: TypeScript type checker builds Abstract Syntax Tree and proves type soundness before execution.",
                        "Step 3: Transpiler strips type annotations entirely (type erasure), emitting standard ECMAScript.",
                        "Step 4: Node.js V8 engine executes lightweight JavaScript with zero runtime memory penalty."
                    ]
                }
            }

        # Docker / Containerization
        if "docker" in lower or "container" in lower:
            return {
                "title": project_title or "Multi-Stage Production Containerization",
                "skill_name": skill_name,
                "experience_level": experience_level,
                "syllabus_steps": [
                    {
                        "step_number": 1,
                        "field_key": "valid_test",
                        "title": "Multi-Stage Build & Dependency Isolation",
                        "subtitle": "Define lightweight base image and separate build/runtime stages in Dockerfile",
                        "target_file": "Dockerfile",
                        "points": 2,
                        "starter_code": "FROM python:3.12-slim AS builder\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir --prefix=/install -r requirements.txt\n\nFROM python:3.12-slim\nWORKDIR /app\nCOPY --from=builder /install /usr/local\nCOPY . /app\n"
                    },
                    {
                        "step_number": 2,
                        "field_key": "invalid_test",
                        "title": "Non-Root User & Linux Isolation Perimeter",
                        "subtitle": "Create dedicated unprivileged system user and set working permissions",
                        "target_file": "Dockerfile",
                        "points": 2,
                        "starter_code": "RUN useradd -u 1001 -m appuser && chown -R appuser:appuser /app\nUSER appuser\n"
                    },
                    {
                        "step_number": 3,
                        "field_key": "auth_test",
                        "title": "Networking, Environment & Healthcheck Directives",
                        "subtitle": "Configure EXPOSE, environment defaults, and orchestrator health probes",
                        "target_file": "Dockerfile",
                        "points": 3,
                        "starter_code": "EXPOSE 8000\nHEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\\n    CMD curl -f http://localhost:8000/api/health/ || exit 1\nCMD [\"python\", \"manage.py\", \"runserver\", \"0.0.0.0:8000\"]\n"
                    },
                    {
                        "step_number": 4,
                        "field_key": "assertions",
                        "title": "Docker Compose & Volume Persistence",
                        "subtitle": "Define compose services, volume mounts, and restart policies",
                        "target_file": "docker-compose.yml",
                        "points": 2,
                        "starter_code": "version: '3.8'\nservices:\n  app:\n    build: .\n    ports:\n      - '8000:8000'\n    environment:\n      - DATABASE_URL=postgres://user:pass@db:5432/app\n    depends_on:\n      - db\n"
                    },
                    {
                        "step_number": 5,
                        "field_key": "explanation",
                        "title": "Container Security & Layer Caching Rationale",
                        "subtitle": "Explain attack surface minimization, build layer ordering, and host isolation",
                        "target_file": "CONTAINER_SECURITY.md",
                        "points": 1,
                        "starter_code": "Explain how multi-stage builds eliminate compiler tooling from the final image, and why unprivileged execution prevents container escapes."
                    }
                ],
                "rubric": [
                    {"id": "c1", "name": "1. Multi-Stage Dockerfile", "pts": 2, "desc": "Lightweight base image, layer caching, and separate build/runtime stages."},
                    {"id": "c2", "name": "2. Non-Root Execution", "pts": 2, "desc": "Runs under dedicated unprivileged user for container security."},
                    {"id": "c3", "name": "3. Networking & Healthcheck", "pts": 3, "desc": "Explicit EXPOSE 8000 and HEALTHCHECK instruction validating uptime."},
                    {"id": "c4", "name": "4. Compose & Environment Config", "pts": 2, "desc": "Proper compose orchestration and volume mounts."},
                    {"id": "c5", "name": "5. Container Isolation Rationale", "pts": 1, "desc": "Explanation of immutable containers and host volume sharing."}
                ],
                "concept_animation": {
                    "type": "custom_pipeline",
                    "title": "Interactive Concept Animation: Docker Containerization & Multi-Stage Build",
                    "description": "Visual walkthrough of layer caching, artifact extraction, non-root user switching, and orchestrator health probing.",
                    "nodes": [
                        {"id": "n1", "name": "Dockerfile Directives", "detail": "Layered Specifications", "icon": "Code", "status_text": "Caching layers"},
                        {"id": "n2", "name": "BuildKit Builder", "detail": "Compile & Dependency Purge", "icon": "Cpu", "status_text": "Stripping tools"},
                        {"id": "n3", "name": "Unprivileged User", "detail": "UID 1001 cgroups Sandbox", "icon": "ShieldCheck", "status_text": "Root disabled"},
                        {"id": "n4", "name": "Container Healthcheck", "detail": "0.0.0.0:8000 Probe", "icon": "CheckCircle2", "status_text": "Healthy 200 OK"}
                    ],
                    "steps": [
                        "Step 1: Docker CLI parses multi-stage instructions and evaluates cached filesystem layers.",
                        "Step 2: Builder stage compiles dependencies and discards heavy compiler packages.",
                        "Step 3: Runtime container switches to unprivileged appuser (UID 1001) preventing privilege escalations.",
                        "Step 4: Container daemon executes periodic curl healthchecks to verify production readiness."
                    ]
                }
            }

        # PostgreSQL / SQL Database
        if "sql" in lower or "postgres" in lower or "database" in lower:
            return {
                "title": project_title or "Relational Schema Design & Query Optimization",
                "skill_name": skill_name,
                "experience_level": experience_level,
                "syllabus_steps": [
                    {
                        "step_number": 1,
                        "field_key": "valid_test",
                        "title": "Relational Schema & Constraints DDL",
                        "subtitle": "CREATE TABLE with primary keys, foreign keys, and check constraints",
                        "target_file": "schema.sql",
                        "points": 2,
                        "starter_code": "CREATE TABLE orders (\n    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n    user_id VARCHAR(100) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,\n    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),\n    status VARCHAR(50) DEFAULT 'pending',\n    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n);\n"
                    },
                    {
                        "step_number": 2,
                        "field_key": "invalid_test",
                        "title": "Safe Schema Migrations & Integrity",
                        "subtitle": "Safe ALTER TABLE operations with non-blocking index additions",
                        "target_file": "migrations/0002_add_index.sql",
                        "points": 2,
                        "starter_code": "ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(100);\nCREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_created ON orders (user_id, created_at DESC);\n"
                    },
                    {
                        "step_number": 3,
                        "field_key": "auth_test",
                        "title": "Parameterized Queries & Multi-Table Joins",
                        "subtitle": "SQL query preventing injection and optimizing join cardinality",
                        "target_file": "queries.sql",
                        "points": 3,
                        "starter_code": "SELECT o.order_id, o.amount, o.status, u.email\nFROM orders o\nJOIN users u ON o.user_id = u.user_id\nWHERE o.status = $1 AND o.created_at >= $2\nORDER BY o.created_at DESC\nLIMIT 20;\n"
                    },
                    {
                        "step_number": 4,
                        "field_key": "assertions",
                        "title": "Indexing Strategy & EXPLAIN ANALYZE",
                        "subtitle": "Verify B-Tree index scan replaces sequential table scans",
                        "target_file": "explain.sql",
                        "points": 2,
                        "starter_code": "CREATE UNIQUE INDEX idx_user_active_order ON orders (user_id) WHERE status = 'pending';\nEXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = $1;\n"
                    },
                    {
                        "step_number": 5,
                        "field_key": "explanation",
                        "title": "ACID Integrity & Concurrency Rationale",
                        "subtitle": "Justify transaction isolation levels, row locking, and durability guarantees",
                        "target_file": "DB_ARCHITECTURE.md",
                        "points": 1,
                        "starter_code": "Explain how foreign key cascades ensure referential integrity, check constraints prevent negative balances, and compound indexes accelerate lookup latency under ACID isolation."
                    }
                ],
                "rubric": [
                    {"id": "c1", "name": "1. Relational Schema & Constraints", "pts": 2, "desc": "Primary keys, foreign keys with ON DELETE, and check constraints."},
                    {"id": "c2", "name": "2. Schema Migration & Integrity", "pts": 2, "desc": "Safe migration steps and versioned schema alterations."},
                    {"id": "c3", "name": "3. Complex Query & Parameterization", "pts": 3, "desc": "Parameterized joins, aggregations, and subqueries."},
                    {"id": "c4", "name": "4. Indexing Strategy", "pts": 2, "desc": "B-Tree or GIN index for high-traffic lookup columns."},
                    {"id": "c5", "name": "5. ACID & Data Integrity Rationale", "pts": 1, "desc": "Explains transaction isolation and concurrency protection."}
                ],
                "concept_animation": {
                    "type": "custom_pipeline",
                    "title": "Interactive Concept Animation: PostgreSQL Query Execution & Index Scan Flow",
                    "description": "Visual walkthrough of connection pooling, cost-based query planner, B-tree index scan, and WAL disk commit.",
                    "nodes": [
                        {"id": "n1", "name": "Session Pool", "detail": "Neon / PgBouncer Pool", "icon": "Database", "status_text": "Acquired session"},
                        {"id": "n2", "name": "Query Planner", "detail": "Cost Optimizer (Index Scan)", "icon": "Cpu", "status_text": "Skipping 1M rows"},
                        {"id": "n3", "name": "Constraint Engine", "detail": "FK & Check Constraint Check", "icon": "ShieldCheck", "status_text": "ACID Validated"},
                        {"id": "n4", "name": "WAL Persistence", "detail": "Write-Ahead Log fsync()", "icon": "CheckCircle2", "status_text": "Durable Commit"}
                    ],
                    "steps": [
                        "Step 1: Application acquires pooled connection from Neon PostgreSQL pool.",
                        "Step 2: Cost-based query optimizer selects B-tree index scan over sequential disk scan.",
                        "Step 3: Constraint engine validates foreign keys and check rules before mutating buffer pages.",
                        "Step 4: Write-Ahead Log (WAL) safely syncs transaction to durable storage."
                    ]
                }
            }

        # Git & Version Control
        if "git" in lower:
            return {
                "title": project_title or "Professional Git Workflows & Atomic Commit Hygiene",
                "skill_name": skill_name,
                "experience_level": experience_level,
                "syllabus_steps": [
                    {
                        "step_number": 1,
                        "field_key": "valid_test",
                        "title": "Atomic Staging & Conventional Commits",
                        "subtitle": "Stage specific hunks with git add -p and write conventional commit messages",
                        "target_file": "git_workflow.sh",
                        "points": 2,
                        "starter_code": "git checkout -b feature/order-idempotency\ngit add src/services/order.ts\ngit commit -m \"feat(order): implement idempotency key check to prevent duplicate charges\"\n"
                    },
                    {
                        "step_number": 2,
                        "field_key": "invalid_test",
                        "title": "Branch Rebase & Interactive Squashing",
                        "subtitle": "Keep linear Git history using git rebase -i and conflict resolution",
                        "target_file": "git_rebase.sh",
                        "points": 2,
                        "starter_code": "git fetch origin main\ngit rebase origin/main\n# In case of conflicts: resolve, then:\ngit add .\ngit rebase --continue\n"
                    },
                    {
                        "step_number": 3,
                        "field_key": "auth_test",
                        "title": "Pre-Commit Hooks & Quality Gates",
                        "subtitle": "Configure husky/pre-commit for linting, secret scanning, and type checks",
                        "target_file": ".husky/pre-commit",
                        "points": 3,
                        "starter_code": "#!/usr/bin/env sh\n. \"$(dirname -- \"$0\")/_/husky.sh\"\n\nnpx lint-staged\nnpx tsc --noEmit\n"
                    },
                    {
                        "step_number": 4,
                        "field_key": "assertions",
                        "title": "Clean Pull Request & Review Checklist",
                        "subtitle": "Create pull request template with test coverage and verification instructions",
                        "target_file": ".github/PULL_REQUEST_TEMPLATE.md",
                        "points": 2,
                        "starter_code": "## Summary\n- Idempotency key verification\n\n## Verification\n- [x] Unit tests pass: `npm test`\n- [x] Type check passes: `npx tsc --noEmit`\n"
                    },
                    {
                        "step_number": 5,
                        "field_key": "explanation",
                        "title": "Git Internal Objects & DAG Rationale",
                        "subtitle": "Explain blobs, trees, commit objects, and merge vs rebase trade-offs",
                        "target_file": "GIT_ARCHITECTURE.md",
                        "points": 1,
                        "starter_code": "Explain how Git represents files as content-addressable SHA-1 blobs, and why linear rebase histories improve bisect debugging."
                    }
                ],
                "rubric": [
                    {"id": "c1", "name": "1. Atomic Commits & Semantics", "pts": 2, "desc": "Clean conventional commit messages and single-purpose changes."},
                    {"id": "c2", "name": "2. Linear Rebase & Conflict Handling", "pts": 2, "desc": "Rebasing against origin/main and resolving conflicts cleanly."},
                    {"id": "c3", "name": "3. Automated Pre-Commit Gates", "pts": 3, "desc": "Linting, static typing, and security hooks before commit creation."},
                    {"id": "c4", "name": "4. Pull Request Standards", "pts": 2, "desc": "Structured PR descriptions and test verification proof."},
                    {"id": "c5", "name": "5. Git DAG & Object Model Rationale", "pts": 1, "desc": "Understanding of commit trees, references, and fast-forward merges."}
                ],
                "concept_animation": {
                    "type": "custom_pipeline",
                    "title": "Interactive Concept Animation: Git Working Tree to Remote DAG Flow",
                    "description": "Visual walkthrough of Working Directory, Staging Index, Local Commit Tree, and Remote Branch Sync.",
                    "nodes": [
                        {"id": "n1", "name": "Working Tree", "detail": "Modified Source Files", "icon": "Code", "status_text": "Diffs detected"},
                        {"id": "n2", "name": "Staging Index", "detail": "git add (SHA-1 Blobs)", "icon": "Layers", "status_text": "Staged for commit"},
                        {"id": "n3", "name": "Local Commit DAG", "detail": "Immutable Tree Pointer", "icon": "GitBranch", "status_text": "Signed commit"},
                        {"id": "n4", "name": "Remote Tracking", "detail": "origin/main Fast-Forward", "icon": "CheckCircle2", "status_text": "Synced"}
                    ],
                    "steps": [
                        "Step 1: File changes in working directory are analyzed by Git status.",
                        "Step 2: Developer stages atomic changes; Git creates SHA-1 hashed blob objects in index.",
                        "Step 3: Commit creates an immutable tree snapshot referencing the parent commit SHA.",
                        "Step 4: Push syncs commits to remote tracking branch with zero conflict history."
                    ]
                }
            }

        # General Skill Fallback
        return {
            "title": project_title or f"Practical Technical Assessment: {skill_name}",
            "skill_name": skill_name,
            "experience_level": experience_level,
            "syllabus_steps": [
                {
                    "step_number": 1,
                    "field_key": "valid_test",
                    "title": f"Core {skill_name} Implementation",
                    "subtitle": f"Implement primary business logic and interfaces for {skill_name}",
                    "target_file": target_deliverables[0] if target_deliverables else "src/deliverable.ts",
                    "points": 2,
                    "starter_code": f"# Core implementation for {skill_name}\n# Implement primary requirements with clean modularity\n"
                },
                {
                    "step_number": 2,
                    "field_key": "invalid_test",
                    "title": "Edge Case & Input Boundary Handling",
                    "subtitle": "Guard against malformed payloads, empty values, and boundary conditions",
                    "target_file": target_deliverables[1] if len(target_deliverables) > 1 else "src/validator.ts",
                    "points": 2,
                    "starter_code": f"# Input validation and boundary error handling for {skill_name}\n"
                },
                {
                    "step_number": 3,
                    "field_key": "auth_test",
                    "title": "Security, Lifecycle & Resource Management",
                    "subtitle": "Ensure clean state teardown, authorization guards, and configuration safety",
                    "target_file": target_deliverables[2] if len(target_deliverables) > 2 else "src/security.ts",
                    "points": 3,
                    "starter_code": f"# Security guards and resource management for {skill_name}\n"
                },
                {
                    "step_number": 4,
                    "field_key": "assertions",
                    "title": "Verification Assertions & Output Contracts",
                    "subtitle": "Write contract assertions verifying expected outputs and error propagation",
                    "target_file": "tests/deliverable.spec.ts",
                    "points": 2,
                    "starter_code": f"# Test assertions verifying {skill_name} deliverables\n"
                },
                {
                    "step_number": 5,
                    "field_key": "explanation",
                    "title": "Engineering Trade-offs & Architecture",
                    "subtitle": "Explain architectural design decisions, maintainability, and scalability reasoning",
                    "target_file": "ARCHITECTURE.md",
                    "points": 1,
                    "starter_code": f"Explain the architectural design and implementation approach for this {skill_name} deliverable."
                }
            ],
            "rubric": [
                {"id": "c1", "name": f"1. Core {skill_name} Implementation", "pts": 2, "desc": f"Functional implementation of {skill_name} deliverable."},
                {"id": "c2", "name": "2. Edge Cases & Boundary Handling", "pts": 2, "desc": "Boundary condition checking and robust exception safety."},
                {"id": "c3", "name": "3. Security & Resource Guards", "pts": 3, "desc": "Input sanitization, credential handling, or permission checks."},
                {"id": "c4", "name": "4. Output Verification & Contracts", "pts": 2, "desc": "Idiomatic conventions, modularity, and clean structure."},
                {"id": "c5", "name": "5. Engineering Rationale", "pts": 1, "desc": "Trade-off analysis, maintainability, and scalability reasoning."}
            ],
            "concept_animation": {
                "type": "custom_pipeline",
                "title": f"Interactive Concept Animation: {skill_name} Execution Flow",
                "description": f"Visual walkthrough of input contract, boundary guards, execution logic, and verified outputs in {skill_name}.",
                "nodes": [
                    {"id": "n1", "name": "Input Contract", "detail": "Parameter Specifications", "icon": "Code", "status_text": "Parsed"},
                    {"id": "n2", "name": "Perimeter Guard", "detail": "Boundary Validation", "icon": "ShieldCheck", "status_text": "Sanitizing"},
                    {"id": "n3", "name": "Core Service", "detail": f"{skill_name} Processing", "icon": "Cpu", "status_text": "Executing"},
                    {"id": "n4", "name": "Verified Output", "detail": "Contract Adherence", "icon": "CheckCircle2", "status_text": "Passed 10/10"}
                ],
                "steps": [
                    f"Step 1: Input arguments and environment settings for {skill_name} are initialized.",
                    f"Step 2: Boundary validation guards inspect incoming requests, rejecting malformed inputs.",
                    f"Step 3: Core {skill_name} logic executes state mutations under safe isolation boundaries.",
                    f"Step 4: Contract assertions verify responses, guaranteeing production reliability."
                ]
            }
        }
