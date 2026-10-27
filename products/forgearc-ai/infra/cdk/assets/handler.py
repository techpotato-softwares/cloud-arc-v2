"""Lambda entrypoints for the ForgeArc AI API and SQS worker.

The CDK bundler places this file at the root of the deployment package, next to
the application packages. Database credentials are resolved before those
packages read settings.
"""


def api_handler(event, context):
    from forgearc_ai_api.bootstrap import prepare_database_url

    prepare_database_url()
    from forgearc_ai_api.worker import api_handler as handle

    return handle(event, context)


def handler(event, context):
    from forgearc_ai_api.bootstrap import prepare_database_url

    prepare_database_url()
    from forgearc_ai_api.worker import handler as handle

    return handle(event, context)
