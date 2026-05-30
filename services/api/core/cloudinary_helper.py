"""Cloudinary upload helper."""
import cloudinary
import cloudinary.uploader
from core.config import get_settings

settings = get_settings()

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)


async def upload_image(file_bytes: bytes, folder: str = "scjygm/products") -> str:
    """Upload image bytes to Cloudinary and return the secure URL."""
    result = cloudinary.uploader.upload(
        file_bytes,
        folder=folder,
        resource_type="image",
        overwrite=False,
    )
    return result["secure_url"]


async def delete_image(public_id: str) -> None:
    cloudinary.uploader.destroy(public_id)
