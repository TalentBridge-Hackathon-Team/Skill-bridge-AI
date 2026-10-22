"""
SkillBridge AI - AWS & LocalStack Integration Service
Manages S3 object storage for learner resumes and SQS job dispatching.
Includes graceful fallbacks when boto3 is not installed or AWS/LocalStack is offline.
"""

import json
import logging
import uuid
from typing import Optional, Dict, Any
from django.conf import settings

logger = logging.getLogger(__name__)

try:
    import boto3
    from botocore.config import Config
    BOTO3_AVAILABLE = True
except ImportError:
    boto3 = None
    Config = None
    BOTO3_AVAILABLE = False
    logger.warning("boto3 is not installed in the active Python environment. AWS services will run in offline mock mode.")


def get_boto3_client(service_name: str):
    """
    Constructs a boto3 client pointing to LocalStack if AWS_ENDPOINT_URL is configured,
    or default AWS cloud endpoints in production. Returns None if boto3 is unavailable.
    """
    if not BOTO3_AVAILABLE:
        return None

    endpoint_url = getattr(settings, 'AWS_ENDPOINT_URL', None) or None
    region_name = getattr(settings, 'AWS_REGION', 'us-east-1')
    aws_access_key_id = getattr(settings, 'AWS_ACCESS_KEY_ID', 'test')
    aws_secret_access_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', 'test')

    try:
        return boto3.client(
            service_name,
            region_name=region_name,
            endpoint_url=endpoint_url,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            config=Config(s3={'addressing_style': 'path'}) if service_name == 's3' else None
        )
    except Exception as exc:
        logger.warning(f"Could not initialize boto3 client for '{service_name}': {exc}")
        return None


class ResumePipelineService:
    """
    Orchestrates resume file storage in S3 and asynchronous processing jobs via SQS.
    Falls back gracefully if AWS or LocalStack is offline.
    """

    def __init__(self):
        self.bucket_name = getattr(settings, 'AWS_S3_BUCKET_NAME', 'skillbridge-resumes')
        self.queue_url = getattr(settings, 'AWS_SQS_RESUME_QUEUE_URL', '')
        self._s3 = None
        self._sqs = None

    @property
    def s3(self):
        if self._s3 is None and BOTO3_AVAILABLE:
            self._s3 = get_boto3_client('s3')
        return self._s3

    @property
    def sqs(self):
        if self._sqs is None and BOTO3_AVAILABLE:
            self._sqs = get_boto3_client('sqs')
        return self._sqs

    def upload_resume(
        self,
        file_source,
        user_id: str,
        filename: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Uploads a resume (either file object, bytes, or file-like) to S3.
        Falls back to mock mode if S3 client is unavailable.
        """
        if isinstance(file_source, (bytes, bytearray)):
            file_bytes = bytes(file_source)
            actual_filename = filename or f"resume_{uuid.uuid4().hex[:8]}.pdf"
            actual_content_type = content_type or "application/pdf"
        else:
            actual_filename = filename or getattr(file_source, 'name', f"resume_{uuid.uuid4().hex[:8]}.pdf")
            actual_content_type = content_type or getattr(file_source, 'content_type', 'application/octet-stream')
            try:
                if hasattr(file_source, 'seek'):
                    file_source.seek(0)
                file_bytes = file_source.read()
                if hasattr(file_source, 'seek'):
                    file_source.seek(0)
            except Exception:
                if hasattr(file_source, 'open'):
                    with file_source.open('rb') as f:
                        file_bytes = f.read()
                else:
                    file_bytes = b""

        clean_filename = actual_filename.replace(' ', '_')
        key = f"resumes/{user_id}/{clean_filename}"

        if not self.s3:
            logger.info("boto3 or S3 client unavailable; running resume upload in offline mock mode.")
            return {
                "success": True,
                "mock": True,
                "bucket": self.bucket_name,
                "key": key,
                "filename": actual_filename,
                "s3_url": f"s3://{self.bucket_name}/{key}"
            }

        try:
            try:
                self.s3.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=file_bytes,
                    ContentType=actual_content_type
                )
            except Exception as put_err:
                if "NoSuchBucket" in str(put_err) or "404" in str(put_err):
                    logger.info("Auto-provisioning missing S3 bucket: %s", self.bucket_name)
                    self.s3.create_bucket(Bucket=self.bucket_name)
                    self.s3.put_object(
                        Bucket=self.bucket_name,
                        Key=key,
                        Body=file_bytes,
                        ContentType=actual_content_type
                    )
                else:
                    raise put_err

            logger.info("Successfully uploaded resume to S3: s3://%s/%s (%d bytes)", self.bucket_name, key, len(file_bytes))
            return {
                "success": True,
                "bucket": self.bucket_name,
                "key": key,
                "filename": actual_filename,
                "s3_url": f"s3://{self.bucket_name}/{key}"
            }
        except Exception as exc:
            logger.error("Failed to upload resume to S3: %s", exc)
            return {
                "success": False,
                "error": str(exc),
                "bucket": self.bucket_name,
                "key": key,
                "filename": actual_filename
            }

    def dispatch_processing_job(self, bucket: str, key: str, user_id: str, filename: str) -> Dict[str, Any]:
        """
        Dispatches a 'resume.uploaded' message to SQS for downstream Lambda consumption.
        Falls back to mock mode if SQS client is unavailable.
        """
        payload = {
            "type": "resume.uploaded",
            "bucket": bucket,
            "key": key,
            "user_id": user_id,
            "filename": filename,
            "job_id": str(uuid.uuid4())
        }

        if not self.sqs or not self.queue_url:
            logger.info("SQS client or queue URL unavailable; running job dispatch in offline mock mode.")
            return {
                "success": True,
                "mock": True,
                "message_id": f"mock-{uuid.uuid4()}",
                "payload": payload
            }

        try:
            try:
                response = self.sqs.send_message(
                    QueueUrl=self.queue_url,
                    MessageBody=json.dumps(payload)
                )
            except Exception as send_err:
                err_str = str(send_err)
                if "NonExistentQueue" in err_str or "QueueDoesNotExist" in err_str:
                    queue_name = self.queue_url.rstrip('/').split('/')[-1]
                    logger.info("Auto-provisioning missing SQS queue: %s", queue_name)
                    create_res = self.sqs.create_queue(QueueName=queue_name)
                    if create_res and "QueueUrl" in create_res:
                        self.queue_url = create_res["QueueUrl"]
                    response = self.sqs.send_message(
                        QueueUrl=self.queue_url,
                        MessageBody=json.dumps(payload)
                    )
                else:
                    raise send_err

            message_id = response.get("MessageId")
            logger.info("Dispatched resume job to SQS: %s (MessageId: %s)", key, message_id)
            return {
                "success": True,
                "message_id": message_id,
                "payload": payload
            }
        except Exception as exc:
            logger.error("Failed to dispatch resume job to SQS: %s", exc)
            return {
                "success": False,
                "error": str(exc),
                "payload": payload
            }


# Global singleton instance
resume_pipeline = ResumePipelineService()
