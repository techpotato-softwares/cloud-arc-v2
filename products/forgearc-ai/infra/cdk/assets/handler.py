def api_handler(event, context):
    return {"statusCode": 200, "headers": {"content-type": "application/json"}, "body": "{\"service\":\"forgearc-ai\"}"}


def handler(event, context):
    failures = []
    for record in event.get("Records", []):
        failures.append({"itemIdentifier": record.get("messageId")})
    return {"batchItemFailures": failures}
