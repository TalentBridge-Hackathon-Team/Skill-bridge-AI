import json


def handler(event, context):
    records = event.get("Records", [])

    for record in records:
        try:
            job = json.loads(record["body"])
        except (KeyError, json.JSONDecodeError) as exc:
            raise ValueError(
                "Invalid resume-processing message"
            ) from exc

        if (
            job.get("type") != "resume.uploaded"
            or not job.get("bucket")
            or not job.get("key")
        ):
            raise ValueError("Invalid resume-processing job")

        print(json.dumps({
            "message": "Resume job received",
            "bucket": job["bucket"],
            "key": job["key"],
        }))

    return {"processed": len(records)}
