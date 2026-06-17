import { SocialFeed, type SocialFeedPost } from "@/components/features/social/SocialFeed";
import { createClient } from "@/lib/supabase/server";

type SocialPostRow = {
  id: string;
  user_id: string;
  author_name: string | null;
  author_avatar_url: string | null;
  caption: string | null;
  location: string | null;
  brazilian_state: string;
  tag: string;
  created_at: string;
};

export default async function SocialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const posts = user ? await fetchSocialFeed(supabase, user.id) : [];

  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Social</h1>
          <p className="mt-2 text-gray-600">Compartilhe fotos, lugares e descobertas com a comunidade Trip Space.</p>
        </div>

        <SocialFeed posts={posts} isAuthenticated={Boolean(user)} currentUserId={user?.id ?? null} />
      </div>
    </div>
  );
}

async function fetchSocialFeed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  currentUserId: string,
): Promise<SocialFeedPost[]> {
  const { data: postRows, error: postsError } = await supabase
    .from("social_posts")
    .select("id, user_id, author_name, author_avatar_url, caption, location, brazilian_state, tag, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (postsError || !postRows?.length) return [];

  const posts = postRows as SocialPostRow[];
  const postIds = posts.map((post) => post.id);

  const [{ data: photoRows }, { data: likeRows }, { data: commentRows }] = await Promise.all([
    supabase
      .from("social_post_photos")
      .select("id, post_id, public_url, sort_order")
      .in("post_id", postIds)
      .order("sort_order", { ascending: true }),
    supabase.from("social_post_likes").select("id, post_id, user_id").in("post_id", postIds),
    supabase
      .from("social_post_comments")
      .select("id, post_id, author_name, author_avatar_url, content, created_at")
      .in("post_id", postIds)
      .order("created_at", { ascending: true }),
  ]);

  return posts.map((post) => {
    const likes = likeRows?.filter((like: any) => like.post_id === post.id) ?? [];
    const comments = commentRows?.filter((comment: any) => comment.post_id === post.id) ?? [];
    const photos = photoRows?.filter((photo: any) => photo.post_id === post.id) ?? [];

    return {
      id: post.id,
      authorId: post.user_id,
      authorName: post.author_name ?? "Tripulante",
      authorAvatarUrl: post.author_avatar_url,
      caption: post.caption ?? "",
      location: post.location ?? "",
      brazilianState: post.brazilian_state,
      tag: post.tag,
      createdAt: post.created_at,
      photos: photos.map((photo: any) => ({
        id: photo.id,
        url: photo.public_url,
        sortOrder: photo.sort_order ?? 0,
      })),
      comments: comments.map((comment: any) => ({
        id: comment.id,
        authorName: comment.author_name ?? "Tripulante",
        authorAvatarUrl: comment.author_avatar_url,
        content: comment.content ?? "",
        createdAt: comment.created_at,
      })),
      likesCount: likes.length,
      likedByCurrentUser: likes.some((like: any) => like.user_id === currentUserId),
    };
  });
}
