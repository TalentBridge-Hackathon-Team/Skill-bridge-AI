#!/bin/bash
set -eo pipefail

echo "=========================================================="
echo "Initializing SkillBridge AWS Infrastructure in LocalStack"
echo "=========================================================="

export AWS_DEFAULT_REGION="us-east-1"

# 1. S3 Bucket
echo "Ensuring S3 bucket 'skillbridge-resumes' exists..."
if ! awslocal s3 ls s3://skillbridge-resumes 2>/dev/null; then
    awslocal s3 mb s3://skillbridge-resumes
    echo "S3 bucket created."
else
    echo "S3 bucket already exists."
fi

# 2. SQS Queue
echo "Ensuring SQS queue 'skillbridge-resume-processing' exists..."
QUEUE_URL=$(awslocal sqs get-queue-url --queue-name skillbridge-resume-processing --output text --query QueueUrl 2>/dev/null || true)
if [ -z "$QUEUE_URL" ]; then
    QUEUE_URL=$(awslocal sqs create-queue --queue-name skillbridge-resume-processing --output text --query QueueUrl)
    echo "Created SQS queue: $QUEUE_URL"
else
    echo "SQS queue already exists: $QUEUE_URL"
fi

QUEUE_ARN=$(awslocal sqs get-queue-attributes --queue-url "$QUEUE_URL" --attribute-names QueueArn --output text --query 'Attributes.QueueArn')

# 3. Lambda Function
echo "Packaging and ensuring Lambda 'skillbridge-resume-processor' exists..."
if [ -f "/opt/code/resume_processor/handler.py" ]; then
    python3 -c "import zipfile; z = zipfile.ZipFile('/tmp/function.zip', 'w'); z.write('/opt/code/resume_processor/handler.py', 'handler.py'); z.close()"
fi

LAMBDA_EXISTS=$(awslocal lambda get-function --function-name skillbridge-resume-processor 2>/dev/null || true)
if [ -z "$LAMBDA_EXISTS" ]; then
    awslocal lambda create-function \
        --function-name skillbridge-resume-processor \
        --runtime python3.12 \
        --handler handler.handler \
        --role arn:aws:iam::000000000000:role/lambda-execution-role \
        --zip-file fileb:///tmp/function.zip \
        --timeout 30
    echo "Created Lambda function."
else
    echo "Lambda function already exists. Updating code..."
    if [ -f "/tmp/function.zip" ]; then
        awslocal lambda update-function-code \
            --function-name skillbridge-resume-processor \
            --zip-file fileb:///tmp/function.zip > /dev/null || true
    fi
fi

# 4. SQS Event Source Mapping
MAPPING_COUNT=$(awslocal lambda list-event-source-mappings --function-name skillbridge-resume-processor --query "length(EventSourceMappings[?EventSourceArn=='$QUEUE_ARN'])" --output text 2>/dev/null || echo "0")
if [ "$MAPPING_COUNT" = "0" ] || [ -z "$MAPPING_COUNT" ]; then
    echo "Creating SQS -> Lambda trigger event source mapping..."
    awslocal lambda create-event-source-mapping \
        --function-name skillbridge-resume-processor \
        --batch-size 1 \
        --event-source-arn "$QUEUE_ARN" || true
else
    echo "SQS -> Lambda trigger mapping already active."
fi

# 5. Database (Neon PostgreSQL is the primary store; DynamoDB removed)
echo "Neon PostgreSQL is the primary database (ep-wispy-lab-bact4jha-pooler.c-8.eu-central-1.aws.neon.tech). Skipping DynamoDB."

# 7. CloudWatch Metric Alarm
echo "Configuring CloudWatch error alarm..."
awslocal cloudwatch put-metric-alarm \
    --alarm-name skillbridge-resume-processor-errors \
    --alarm-description "Alarm when resume processing Lambda encounters errors" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 60 \
    --evaluation-periods 1 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --dimensions Name=FunctionName,Value=skillbridge-resume-processor || true

# 8. API Gateway REST API & Proxy Route
echo "Ensuring API Gateway REST API exists..."
API_ID=$(awslocal apigateway get-rest-apis --query "items[?name=='SkillBridge Django API'].id" --output text 2>/dev/null || true)
if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
    API_ID=$(awslocal apigateway create-rest-api --name "SkillBridge Django API" --output text --query id)
    ROOT_ID=$(awslocal apigateway get-resources --rest-api-id "$API_ID" --query 'items[?path==`/`].id' --output text)
    
    # Create /{proxy+} resource
    RESOURCE_ID=$(awslocal apigateway create-resource --rest-api-id "$API_ID" --parent-id "$ROOT_ID" --path-part '{proxy+}' --output text --query id)
    
    # ANY method on /{proxy+}
    awslocal apigateway put-method --rest-api-id "$API_ID" --resource-id "$RESOURCE_ID" --http-method ANY --authorization-type NONE
    awslocal apigateway put-integration --rest-api-id "$API_ID" --resource-id "$RESOURCE_ID" --http-method ANY --type HTTP_PROXY \
        --integration-http-method ANY --uri 'http://host.docker.internal:8000/{proxy}'
    
    # Root ANY method
    awslocal apigateway put-method --rest-api-id "$API_ID" --resource-id "$ROOT_ID" --http-method ANY --authorization-type NONE
    awslocal apigateway put-integration --rest-api-id "$API_ID" --resource-id "$ROOT_ID" --http-method ANY --type HTTP_PROXY \
        --integration-http-method ANY --uri 'http://host.docker.internal:8000/'
    
    awslocal apigateway create-deployment --rest-api-id "$API_ID" --stage-name dev
    echo "Created API Gateway API: $API_ID (stage: dev)"
else
    echo "API Gateway API already exists: $API_ID"
fi

echo "=========================================================="
echo "SkillBridge AWS Infrastructure Initialized Successfully!"
echo "API Gateway Endpoint: http://localhost:4566/_aws/execute-api/$API_ID/dev/"
echo "=========================================================="
