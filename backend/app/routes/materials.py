import os
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from app import db
from app.models import Material, Topic, User
from app.utils import role_required, log_action, validate_required_fields, paginate_query

materials_bp = Blueprint("materials", __name__)

ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "ppt", "pptx", "txt", "mp4", "webm", "png", "jpg", "jpeg"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@materials_bp.route("", methods=["GET"])
@jwt_required()
def list_materials():
    query = Material.query
    course_id = request.args.get("course_id")
    topic_id = request.args.get("topic_id")
    material_type = request.args.get("type")

    if course_id:
        query = query.filter_by(course_id=course_id)
    if topic_id:
        query = query.filter(Material.topics.any(id=topic_id))
    if material_type:
        query = query.filter_by(material_type=material_type)

    return jsonify(paginate_query(query.order_by(Material.created_at.desc()))), 200


@materials_bp.route("/<material_id>", methods=["GET"])
@jwt_required()
def get_material(material_id):
    material = Material.query.get_or_404(material_id)
    return jsonify(material.to_dict()), 200


@materials_bp.route("/upload", methods=["POST"])
@role_required("admin", "instructor")
def upload_material():
    user_id = get_jwt_identity()
    title = request.form.get("title")
    if not title:
        return jsonify({"error": "Title is required"}), 400

    file = request.files.get("file")
    external_url = request.form.get("external_url")

    if not file and not external_url:
        return jsonify({"error": "Either file or external URL is required"}), 400

    file_path = None
    material_type = request.form.get("material_type", "document")

    if file:
        if not allowed_file(file.filename):
            return jsonify({"error": f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

        filename = secure_filename(file.filename)
        upload_dir = current_app.config["UPLOAD_FOLDER"]
        os.makedirs(upload_dir, exist_ok=True)

        # Add unique prefix
        import uuid
        unique_name = f"{uuid.uuid4().hex[:8]}_{filename}"
        file_path = os.path.join(upload_dir, unique_name)
        file.save(file_path)

        ext = filename.rsplit(".", 1)[1].lower()
        if ext == "pdf":
            material_type = "pdf"
        elif ext in ("mp4", "webm"):
            material_type = "video"
        elif ext in ("png", "jpg", "jpeg"):
            material_type = "image"

    if external_url:
        material_type = "link"

    material = Material(
        title=title,
        description=request.form.get("description", ""),
        material_type=material_type,
        file_path=file_path,
        external_url=external_url,
        course_id=request.form.get("course_id"),
        uploaded_by=user_id,
    )

    topic_ids = request.form.get("topic_ids", "")
    if topic_ids:
        ids = [t.strip() for t in topic_ids.split(",") if t.strip()]
        topics = Topic.query.filter(Topic.id.in_(ids)).all()
        material.topics = topics

    db.session.add(material)
    db.session.commit()

    log_action(user_id, "upload_material", "material", material.id, material.title)
    return jsonify(material.to_dict()), 201


@materials_bp.route("/<material_id>", methods=["PUT"])
@role_required("admin", "instructor")
def update_material(material_id):
    material = Material.query.get_or_404(material_id)
    user_id = get_jwt_identity()

    data = request.get_json()
    if data.get("title"):
        material.title = data["title"]
    if "description" in data:
        material.description = data["description"]
    if "external_url" in data:
        material.external_url = data["external_url"]
    if "course_id" in data:
        material.course_id = data["course_id"]

    topic_ids = data.get("topic_ids")
    if topic_ids is not None:
        topics = Topic.query.filter(Topic.id.in_(topic_ids)).all()
        material.topics = topics

    db.session.commit()
    log_action(user_id, "update_material", "material", material.id)
    return jsonify(material.to_dict()), 200


@materials_bp.route("/<material_id>", methods=["DELETE"])
@role_required("admin")
def delete_material(material_id):
    material = Material.query.get_or_404(material_id)
    user_id = get_jwt_identity()

    # Delete file if exists
    fp = material.file_path
    if fp and not os.path.isabs(fp):
        fp = os.path.join(current_app.config["UPLOAD_FOLDER"], os.path.basename(fp))
    if fp and os.path.exists(fp):
        os.remove(fp)

    db.session.delete(material)
    db.session.commit()

    log_action(user_id, "delete_material", "material", material_id)
    return jsonify({"message": "Material deleted"}), 200


@materials_bp.route("/<material_id>/download", methods=["GET"])
@jwt_required()
def download_material(material_id):
    import mimetypes

    material = Material.query.get_or_404(material_id)

    file_path = material.file_path
    # Resolve relative paths against the configured upload folder
    if file_path and not os.path.isabs(file_path):
        file_path = os.path.join(current_app.config["UPLOAD_FOLDER"], os.path.basename(file_path))

    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    # Build a human-readable download name from the material title + file extension
    ext = os.path.splitext(file_path)[1]  # e.g. ".pdf"
    download_name = secure_filename(material.title or "download") + ext
    mimetype = mimetypes.guess_type(file_path)[0] or "application/octet-stream"

    return send_file(file_path, as_attachment=True, download_name=download_name, mimetype=mimetype)
