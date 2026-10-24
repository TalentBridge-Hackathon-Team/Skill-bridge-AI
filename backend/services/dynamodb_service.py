"""
SkillBridge AI - DynamoDB Service
Manages the UserProfile table in DynamoDB (LocalStack for dev, real AWS in prod).

Table Schema:
  - Partition Key: user_id (String)  — unique per user
  - Sort Key:      record_type (String) — "PROFILE" | "SKILL#<name>" | "PROJECT#<id>"

Access patterns:
  - Get full profile:         PK=user_id, SK="PROFILE"
  - List all skills:          PK=user_id, SK begins_with "SKILL#"
  - List all projects:        PK=user_id, SK begins_with "PROJECT#"
  - Delete user (all items):  query PK=user_id, batch delete

Least-privilege IAM note: Lambda / backend should have only
  dynamodb:GetItem, PutItem, UpdateItem, DeleteItem, Query on this table ARN.
"""

import logging
import uuid
from typing import Any, Dict, Optional
from django.conf import settings

logger = logging.getLogger(__name__)

DYNAMODB_TABLE_NAME = "skillbridge-user-profiles"

try:
    import boto3
    from botocore.exceptions import ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    boto3 = None  # type: ignore
    ClientError = Exception  # type: ignore
    BOTO3_AVAILABLE = False
    logger.warning("boto3 unavailable — DynamoDB service running in offline mock mode.")


def _get_dynamodb():
    """Return a DynamoDB resource pointing at LocalStack or real AWS."""
    if not BOTO3_AVAILABLE:
        return None
    endpoint_url = getattr(settings, "AWS_ENDPOINT_URL", None) or None
    region_name = getattr(settings, "AWS_REGION", "us-east-1")
    try:
        return boto3.resource(
            "dynamodb",
            region_name=region_name,
            endpoint_url=endpoint_url,
            aws_access_key_id=getattr(settings, "AWS_ACCESS_KEY_ID", "test"),
            aws_secret_access_key=getattr(settings, "AWS_SECRET_ACCESS_KEY", "test"),
        )
    except Exception as exc:
        logger.warning("Could not initialise DynamoDB resource: %s", exc)
        return None


def _get_table():
    db = _get_dynamodb()
    if db is None:
        return None
    return db.Table(DYNAMODB_TABLE_NAME)


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def put_profile(profile_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Upsert the PROFILE record for a user.

    Expected keys in profile_data:
      user_id, name, target_role, education, experience_level,
      skills (list[str]), professional_background (str),
      project_descriptions (list[dict]),
      target_date (str ISO), study_capacity_hours_per_week (int),
      resume_s3_url (str)
    """
    user_id = profile_data.get("user_id", "demo_user")
    item = {
        "user_id": user_id,
        "record_type": "PROFILE",
        **{k: v for k, v in profile_data.items() if k not in ("user_id",)},
    }

    table = _get_table()
    if table is None:
        logger.info("DynamoDB offline — mock put_profile for user_id=%s", user_id)
        return {"mock": True, **item}

    try:
        table.put_item(Item=item)
        logger.info("DynamoDB put_profile OK for user_id=%s", user_id)
        return item
    except ClientError as exc:
        logger.error("DynamoDB put_profile error: %s", exc)
        return {"error": str(exc)}


def get_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch the PROFILE record for user_id. Returns None if not found."""
    table = _get_table()
    if table is None:
        logger.info("DynamoDB offline — mock get_profile for user_id=%s", user_id)
        return None
    try:
        resp = table.get_item(Key={"user_id": user_id, "record_type": "PROFILE"})
        return resp.get("Item")
    except ClientError as exc:
        logger.error("DynamoDB get_profile error: %s", exc)
        return None


def put_project(user_id: str, project: Dict[str, Any]) -> Dict[str, Any]:
    """
    Upsert a PROJECT record.
    project should contain: project_id (optional), title, description, link, skills_demonstrated (list).
    """
    project_id = project.get("project_id") or f"proj_{uuid.uuid4().hex[:8]}"
    item = {
        "user_id": user_id,
        "record_type": f"PROJECT#{project_id}",
        "project_id": project_id,
        **{k: v for k, v in project.items() if k != "project_id"},
    }
    table = _get_table()
    if table is None:
        return {"mock": True, **item}
    try:
        table.put_item(Item=item)
        return item
    except ClientError as exc:
        logger.error("DynamoDB put_project error: %s", exc)
        return {"error": str(exc)}


def query_user_records(user_id: str, prefix: str = "") -> list:
    """
    Query all records for a user, optionally filtering by SK prefix
    (e.g. prefix="PROJECT#" to get only projects).
    """
    table = _get_table()
    if table is None:
        return []
    try:
        from boto3.dynamodb.conditions import Key
        if prefix:
            resp = table.query(
                KeyConditionExpression=Key("user_id").eq(user_id) & Key("record_type").begins_with(prefix)
            )
        else:
            resp = table.query(KeyConditionExpression=Key("user_id").eq(user_id))
        return resp.get("Items", [])
    except ClientError as exc:
        logger.error("DynamoDB query error: %s", exc)
        return []
