import random
import string

from django.db import models

from ..models.friendship import Friendship
from ..models.membership import Membership
from .user import User


# Add a random post id, so that ids aren't predictable.
def generate_post_slug():
    return "".join(random.choices(string.ascii_letters + string.digits, k=16))


# An Offer or a Request by a user. May be extended to handle Events.
# If needed, model inheritance may be implemented:
# https://docs.djangoproject.com/en/6.0/topics/db/models/#model-inheritance
class Post(models.Model):
    slug = models.SlugField(max_length=16, unique=True, default=generate_post_slug)

    # User who created the post.
    owner = models.ForeignKey(User, on_delete=models.CASCADE)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Post info visible to other users.

    title = models.CharField(max_length=255)
    class PostType(models.TextChoices):
        OFFER = "offer"
        REQUEST = "request"

    type = models.CharField(
        max_length=31, choices=PostType.choices, default=PostType.OFFER
    )
    description = models.TextField()
    # TODO: category (categories?)

    # Sharing settings

    # Whether the post is visible publicly.
    public = models.BooleanField(default=False)

    # Collective sharing
    share_with_new_collectives_default = models.BooleanField(default=True)
    # Memberships that share this post
    shared_memberships = models.ManyToManyField(Membership, related_name="shared_posts")

    # Friend sharing
    share_with_new_friends_default = models.BooleanField(default=True)
    # Friendships that share this post
    shared_friendships = models.ManyToManyField(Friendship, related_name="shared_posts")

    def __str__(self) -> str:
        return self.title
