import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.db import OperationalError, DatabaseError

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    Custom exception handler for Django REST Framework.
    Ensures that ALL errors (including DB connection failures and unhandled 500s)
    always return clean, structured JSON payloads and NEVER raw HTML.
    """
    response = exception_handler(exc, context)

    if response is None:
        view_name = context.get('view').__class__.__name__ if context.get('view') else 'UnknownView'
        logger.error("Unhandled API exception in %s: %s", view_name, exc, exc_info=True)

        if isinstance(exc, (OperationalError, DatabaseError)):
            return Response(
                {"detail": "Database connection is temporarily unavailable. Please retry in a moment."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {"detail": "A server error occurred. Please try again shortly."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return response
