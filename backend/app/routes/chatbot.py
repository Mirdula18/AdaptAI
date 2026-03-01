import json
import uuid
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import ChatMessage, User
from app.llm_service import LLMService, LLMConnectionError

chatbot_bp = Blueprint("chatbot", __name__)


@chatbot_bp.route("/message", methods=["POST"])
@jwt_required()
def send_message():
    """Send a message to the AI chatbot and get a response."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    data = request.get_json()

    message = data.get("message", "").strip()
    session_id = data.get("session_id") or str(uuid.uuid4())

    if not message:
        return jsonify({"error": "Message is required"}), 400

    # Save user message
    user_msg = ChatMessage(
        user_id=user_id,
        role="user",
        content=message,
        session_id=session_id,
    )
    db.session.add(user_msg)
    db.session.flush()

    # Build conversation context (last 10 messages in session)
    history = (
        ChatMessage.query.filter_by(user_id=user_id, session_id=session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
        .all()
    )
    history.reverse()

    conversation = "\n".join(
        f"{'Student' if m.role == 'user' else 'AI Tutor'}: {m.content}"
        for m in history
    )

    prompt = f"""You are AdaptIQ AI Tutor, a helpful and encouraging educational assistant
for the AdaptIQ learning platform. You help students with their studies, explain concepts,
and provide guidance on their learning journey.

Student name: {user.full_name}

Conversation so far:
{conversation}

Respond helpfully, concisely, and encouragingly as the AI Tutor. If the student asks about
something unrelated to education, gently guide them back to learning topics.

AI Tutor:"""

    try:
        response = LLMService._call_ollama(prompt, temperature=0.7, max_tokens=1024)
        response = response.strip()
        # Strip any echoed "AI Tutor:" prefix the LLM may add
        import re
        response = re.sub(r'^\*{0,2}\s*AI\s*Tutor\s*:?\s*\*{0,2}\s*', '', response, flags=re.IGNORECASE).strip()
        if not response:
            response = "I'm here to help! Could you rephrase your question?"
    except LLMConnectionError:
        response = (
            "I'm having trouble connecting to my brain right now. "
            "Please make sure the AI service is running and try again!"
        )

    # Save assistant message
    assistant_msg = ChatMessage(
        user_id=user_id,
        role="assistant",
        content=response,
        session_id=session_id,
    )
    db.session.add(assistant_msg)
    db.session.commit()

    return jsonify({
        "response": response,
        "session_id": session_id,
        "message_id": assistant_msg.id,
    }), 200


@chatbot_bp.route("/history", methods=["GET"])
@jwt_required()
def chat_history():
    """Get chat history for the current user."""
    user_id = get_jwt_identity()
    session_id = request.args.get("session_id")

    query = ChatMessage.query.filter_by(user_id=user_id)
    if session_id:
        query = query.filter_by(session_id=session_id)

    messages = query.order_by(ChatMessage.created_at.asc()).limit(100).all()
    return jsonify([m.to_dict() for m in messages]), 200


@chatbot_bp.route("/sessions", methods=["GET"])
@jwt_required()
def chat_sessions():
    """Get list of chat sessions."""
    user_id = get_jwt_identity()
    sessions = (
        db.session.query(ChatMessage.session_id, db.func.min(ChatMessage.created_at), db.func.count())
        .filter_by(user_id=user_id)
        .group_by(ChatMessage.session_id)
        .order_by(db.func.max(ChatMessage.created_at).desc())
        .limit(20)
        .all()
    )
    return jsonify([
        {"session_id": s[0], "started_at": s[1].isoformat() if s[1] else None, "message_count": s[2]}
        for s in sessions
    ]), 200


@chatbot_bp.route("/sessions/<session_id>", methods=["DELETE"])
@jwt_required()
def delete_session(session_id):
    """Delete a chat session."""
    user_id = get_jwt_identity()
    ChatMessage.query.filter_by(user_id=user_id, session_id=session_id).delete()
    db.session.commit()
    return jsonify({"message": "Chat session deleted"}), 200
