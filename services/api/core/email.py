"""Stub email sender – logs to console in dev, sends real SMTP in production."""
import logging
from core.config import get_settings

logger = logging.getLogger("email")
settings = get_settings()


async def send_email(to: str, subject: str, body_html: str) -> None:
    if settings.app_env == "development" or not settings.smtp_host:
        logger.info(
            "DEV EMAIL to=%s subject=%s\n%s", to, subject, body_html
        )
        return

    try:
        import aiosmtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.email_from
        msg["To"] = to
        msg.attach(MIMEText(body_html, "html"))

        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_pass or None,
            start_tls=False,
        )
    except Exception:
        logger.exception("Failed to send email to %s", to)


async def send_password_reset_email(to: str, token: str) -> None:
    reset_url = f"{settings.api_base_url}/auth/reset-password?token={token}"
    body = f"""
    <h2>Password Reset</h2>
    <p>Click the link below to reset your password. This link expires in 1 hour.</p>
    <a href="{reset_url}">{reset_url}</a>
    <p>If you did not request this, ignore this email.</p>
    """
    await send_email(to, "Reset your SCJYGM password", body)
