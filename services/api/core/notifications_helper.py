"""Notification utilities for use in other routers."""
from motor.motor_asyncio import AsyncIOMotorDatabase


async def notify_user(
    db: AsyncIOMotorDatabase,
    user_id: str,
    title: str,
    body: str,
    image_url: str | None = None,
    video_url: str | None = None,
    youtube_url: str | None = None,
    deep_link: str | None = None,
    notification_type: str = "GENERAL",
) -> None:
    """
    Notify a user by creating a notification + sending push.
    
    Import this in other routers to send notifications on events:
    
    from routers.notifications import notify_user
    
    await notify_user(
        db,
        user_id="xxx",
        title="New comment",
        body="Someone replied to your product"
    )
    """
    from routers.notifications import create_and_send_notification
    
    await create_and_send_notification(
        db,
        user_id,
        title=title,
        body=body,
        image_url=image_url,
        video_url=video_url,
        youtube_url=youtube_url,
        deep_link=deep_link,
        notification_type=notification_type,
    )
