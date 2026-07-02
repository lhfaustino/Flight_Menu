"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  EllipsisVertical,
  Heart,
  ImagePlus,
  MapPin,
  MessageCircle,
  Navigation,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { createSocialComment, createSocialPost, deleteSocialPost, toggleSocialPostLike, updateSocialPost } from "@/app/actions/social";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, Modal, ModalOverlay } from "@/components/ui/Modal";
import { clearAppRuntimeCaches } from "@/lib/app-cache";
import { BRAZILIAN_STATES, SOCIAL_TAGS } from "@/lib/social-options";
import { cn } from "@/lib/utils";

export type SocialFeedPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  caption: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  brazilianState: string;
  tag: string;
  createdAt: string;
  photos: { id: string; url: string; sortOrder: number }[];
  comments: {
    id: string;
    authorName: string;
    authorAvatarUrl: string | null;
    content: string;
    createdAt: string;
  }[];
  likesCount: number;
  likedByCurrentUser: boolean;
};

type SocialFeedProps = {
  posts: SocialFeedPost[];
  isAuthenticated: boolean;
  currentUserId: string | null;
};

export function SocialFeed({ posts, isAuthenticated, currentUserId }: SocialFeedProps) {
  const router = useRouter();
  const [visiblePosts, setVisiblePosts] = React.useState(posts);
  const [stateFilter, setStateFilter] = React.useState("all");
  const [tagFilter, setTagFilter] = React.useState("all");
  const [message, setMessage] = React.useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = React.useState(false);
  const [composerResetKey, setComposerResetKey] = React.useState(0);
  const [isPosting, startPostTransition] = React.useTransition();

  React.useEffect(() => {
    setVisiblePosts(posts);
  }, [posts]);

  const filteredPosts = React.useMemo(
    () =>
      visiblePosts.filter((post) => {
        if (stateFilter !== "all" && post.brazilianState !== stateFilter) return false;
        if (tagFilter !== "all" && post.tag !== tagFilter) return false;
        return true;
      }),
    [visiblePosts, stateFilter, tagFilter],
  );

  const activeFilters = [stateFilter !== "all", tagFilter !== "all"].filter(Boolean).length;

  function handleCreatePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    startPostTransition(async () => {
      const result = await createSocialPost(formData);
      if (result.success) {
        form.reset();
        setComposerResetKey((key) => key + 1);
        setMessage("Publicacao criada.");
        setIsComposerOpen(false);
        router.refresh();
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <UsersRound className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">Compartilhar no Social</h2>
              <p className="text-sm text-gray-500">Fotos, lugares e dicas da comunidade.</p>
            </div>
          </div>
          <Button
            type="button"
            iconLeading={ImagePlus}
            onPress={() => setIsComposerOpen(true)}
            isDisabled={!isAuthenticated}
            className="w-full sm:w-auto"
          >
            Postar
          </Button>
        </div>
        <p className={cn("mt-3 text-sm", message?.includes("criada") ? "text-success-700" : "text-gray-500")}>
          {isAuthenticated ? message : "Entre na sua conta para publicar, curtir e comentar."}
        </p>
      </section>

      <PostComposerModal
        isOpen={isComposerOpen}
        isPosting={isPosting}
        isAuthenticated={isAuthenticated}
        message={message}
        resetKey={composerResetKey}
        onOpenChange={setIsComposerOpen}
        onSubmit={handleCreatePost}
      />

      <section className="rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="grid flex-1 gap-1.5 text-sm font-semibold text-gray-700">
            Estado
            <select
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10"
            >
              <option value="all">Todos</option>
              {BRAZILIAN_STATES.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.value} - {state.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid flex-1 gap-1.5 text-sm font-semibold text-gray-700">
            Tag
            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10"
            >
              <option value="all">Todas</option>
              {SOCIAL_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            iconLeading={RotateCcw}
            isDisabled={activeFilters === 0}
            onPress={() => {
              setStateFilter("all");
              setTagFilter("all");
            }}
            className="h-10 sm:w-auto"
          >
            Limpar
          </Button>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          {filteredPosts.length} de {visiblePosts.length} publicacoes
        </p>
      </section>

      <section className="grid gap-5">
        {filteredPosts.length > 0 ? (
          filteredPosts.map((post) => (
            <SocialPostCard
              key={post.id}
              post={post}
              isAuthenticated={isAuthenticated}
              currentUserId={currentUserId}
              onDeleted={(postId) => setVisiblePosts((current) => current.filter((item) => item.id !== postId))}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <UsersRound className="mx-auto mb-3 size-8 text-gray-300" />
            <h3 className="font-semibold text-gray-900">Nenhuma publicacao encontrada</h3>
            <p className="mt-1 text-sm text-gray-500">Altere os filtros ou crie a primeira publicacao.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function PostComposerModal({
  isOpen,
  isPosting,
  isAuthenticated,
  message,
  resetKey,
  onOpenChange,
  onSubmit,
}: {
  isOpen: boolean;
  isPosting: boolean;
  isAuthenticated: boolean;
  message: string | null;
  resetKey: number;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={!isPosting}
      className="items-stretch justify-stretch p-0 sm:items-stretch sm:justify-stretch sm:p-0"
    >
      <Modal className="h-dvh max-h-dvh w-full max-w-none overflow-hidden rounded-none border-none bg-white shadow-none sm:max-w-none">
        <Dialog className="flex h-full flex-col outline-hidden">
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-gray-900">Novo post</h2>
              <p className="truncate text-sm text-gray-500">Compartilhe fotos com a comunidade.</p>
            </div>
            <Button
              type="button"
              variant="tertiary"
              iconLeading={X}
              onPress={() => onOpenChange(false)}
              isDisabled={isPosting}
              aria-label="Fechar"
              className="size-10 shrink-0 px-0"
            />
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <form className="mx-auto grid w-full max-w-2xl gap-4" onSubmit={onSubmit}>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <UsersRound className="size-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900">Compartilhar no Social</h3>
                  <p className="text-sm text-gray-500">Fotos, lugares e dicas da comunidade.</p>
                </div>
              </div>

              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Fotos
                <input
                  name="photos"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  required
                  disabled={!isAuthenticated || isPosting}
                  className="block w-full rounded-lg border border-gray-300 bg-white text-sm text-gray-700 shadow-xs file:mr-3 file:border-0 file:bg-brand-50 file:px-3 file:py-2.5 file:text-sm file:font-semibold file:text-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-600/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Legenda
                <textarea
                  name="caption"
                  rows={5}
                  placeholder="Conte o que vale a pena saber..."
                  disabled={!isAuthenticated || isPosting}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-3 text-sm text-gray-900 shadow-xs outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <Input name="location" label="Local" placeholder="Ex: Congonhas" required disabled={!isAuthenticated || isPosting} />
                <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                  Estado
                  <select
                    name="brazilianState"
                    required
                    defaultValue=""
                    disabled={!isAuthenticated || isPosting}
                    className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-xs outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {BRAZILIAN_STATES.map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.value} - {state.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                  Tag
                  <select
                    name="tag"
                    required
                    defaultValue=""
                    disabled={!isAuthenticated || isPosting}
                    className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-xs outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {SOCIAL_TAGS.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <LocationCaptureFields disabled={!isAuthenticated || isPosting} resetKey={resetKey} />

              {message && !message.includes("criada") ? <p className="text-sm text-error-600">{message}</p> : null}

              <div className="sticky bottom-0 -mx-4 mt-2 border-t border-gray-200 bg-white px-4 py-4 sm:-mx-6 sm:px-6">
                <div className="mx-auto flex w-full max-w-2xl flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onPress={() => onOpenChange(false)}
                    isDisabled={isPosting}
                    className="w-full sm:w-auto"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="md" iconLeading={ImagePlus} isDisabled={!isAuthenticated || isPosting} className="w-full sm:w-auto">
                    {isPosting ? "Publicando..." : "Publicar"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function EditPostModal({
  post,
  isOpen,
  isPending,
  onOpenChange,
  onMessage,
  startTransition,
  onRefresh,
}: {
  post: SocialFeedPost;
  isOpen: boolean;
  isPending: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onMessage: (message: string | null) => void;
  startTransition: React.TransitionStartFunction;
  onRefresh: () => void;
}) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onMessage(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateSocialPost(post.id, formData);
      if (result.success) {
        onOpenChange(false);
        onRefresh();
      } else {
        onMessage(result.error);
      }
    });
  }

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={!isPending} className="items-end sm:items-center">
      <Modal className="max-h-[90dvh] overflow-hidden bg-white sm:max-w-2xl">
        <Dialog className="flex max-h-[90dvh] flex-col outline-hidden">
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-gray-900">Editar post</h2>
              <p className="truncate text-sm text-gray-500">Atualize legenda, local, estado e tag.</p>
            </div>
            <Button
              type="button"
              variant="tertiary"
              iconLeading={X}
              onPress={() => onOpenChange(false)}
              isDisabled={isPending}
              aria-label="Fechar"
              className="size-10 shrink-0 px-0"
            />
          </header>

          <form className="flex-1 overflow-y-auto px-4 py-5 sm:px-6" onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Legenda
                <textarea
                  name="caption"
                  rows={4}
                  defaultValue={post.caption}
                  placeholder="Conte o que vale a pena saber..."
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-3 text-sm text-gray-900 shadow-xs outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <Input name="location" label="Local" defaultValue={post.location} required disabled={isPending} />
                <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                  Estado
                  <select
                    name="brazilianState"
                    required
                    defaultValue={post.brazilianState}
                    disabled={isPending}
                    className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-xs outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                  >
                    {BRAZILIAN_STATES.map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.value} - {state.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                  Tag
                  <select
                    name="tag"
                    required
                    defaultValue={post.tag}
                    disabled={isPending}
                    className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-xs outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                  >
                    {SOCIAL_TAGS.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <LocationCaptureFields
                disabled={isPending}
                initialLatitude={post.latitude}
                initialLongitude={post.longitude}
                resetKey={`${post.id}:${post.latitude ?? ""}:${post.longitude ?? ""}`}
              />
            </div>

            <div className="sticky bottom-0 -mx-4 mt-5 border-t border-gray-200 bg-white px-4 py-4 sm:-mx-6 sm:px-6">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onPress={() => onOpenChange(false)} isDisabled={isPending} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="submit" iconLeading={Pencil} isDisabled={isPending} className="w-full sm:w-auto">
                  {isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function SocialPostCard({
  post,
  isAuthenticated,
  currentUserId,
  onDeleted,
}: {
  post: SocialFeedPost;
  isAuthenticated: boolean;
  currentUserId: string | null;
  onDeleted: (postId: string) => void;
}) {
  const router = useRouter();
  const [photoIndex, setPhotoIndex] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState(0);
  const touchStartX = React.useRef<number | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const hasMultiplePhotos = post.photos.length > 1;
  const canManagePost = Boolean(currentUserId && post.authorId === currentUserId);
  const mapUrl = getMapNavigationUrl(post.latitude, post.longitude);

  function handleLike() {
    setActionMessage(null);
    startTransition(async () => {
      const result = await toggleSocialPostLike(post.id);
      if (result.success) router.refresh();
      else setActionMessage(result.error);
    });
  }

  function handleComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionMessage(null);
    const value = comment;
    startTransition(async () => {
      const result = await createSocialComment(post.id, value);
      if (result.success) {
        setComment("");
        router.refresh();
      } else {
        setActionMessage(result.error);
      }
    });
  }

  function handleDeletePost() {
    setIsMenuOpen(false);
    setActionMessage(null);

    if (!window.confirm("Excluir esta publicacao?")) return;

    startTransition(async () => {
      const result = await deleteSocialPost(post.id);
      if (result.success) {
        onDeleted(post.id);
        await clearAppRuntimeCaches();
        router.refresh();
      } else {
        setActionMessage(result.error);
      }
    });
  }

  function goToPhoto(index: number) {
    setPhotoIndex(Math.min(Math.max(index, 0), Math.max(post.photos.length - 1, 0)));
    setDragOffset(0);
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (!hasMultiplePhotos) return;
    touchStartX.current = event.touches[0]?.clientX ?? null;
    setDragOffset(0);
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (!hasMultiplePhotos || touchStartX.current === null) return;
    const currentX = event.touches[0]?.clientX ?? touchStartX.current;
    setDragOffset(Math.max(-80, Math.min(80, currentX - touchStartX.current)));
  }

  function handleTouchEnd() {
    if (!hasMultiplePhotos || touchStartX.current === null) return;

    if (dragOffset <= -40 && photoIndex < post.photos.length - 1) {
      goToPhoto(photoIndex + 1);
    } else if (dragOffset >= 40 && photoIndex > 0) {
      goToPhoto(photoIndex - 1);
    } else {
      setDragOffset(0);
    }

    touchStartX.current = null;
  }

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="md" src={post.authorAvatarUrl} initials={getInitials(post.authorName)} alt={post.authorName} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-900">{post.authorName}</h3>
            <p className="flex min-w-0 items-center gap-1 truncate text-xs text-gray-500">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">
                {post.location}, {post.brazilianState}
              </span>
            </p>
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
              >
                <Navigation className="size-3" />
                Abrir rota
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{post.tag}</span>
            <p className="mt-1 text-xs text-gray-500">{formatDateTime(post.createdAt)}</p>
          </div>
          {canManagePost ? (
            <div className="relative">
              <Button
                type="button"
                variant="tertiary"
                iconLeading={EllipsisVertical}
                aria-label="Opcoes da publicacao"
                onPress={() => setIsMenuOpen((current) => !current)}
                className="size-8 px-0"
              />
              {isMenuOpen ? (
                <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsEditOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil className="size-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={handleDeletePost}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-error-700 hover:bg-error-50"
                  >
                    <Trash2 className="size-4" />
                    Excluir
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <EditPostModal
        post={post}
        isOpen={isEditOpen}
        isPending={isPending}
        onOpenChange={setIsEditOpen}
        onMessage={setActionMessage}
        startTransition={startTransition}
        onRefresh={() => router.refresh()}
      />

      <div
        className={cn("relative aspect-square overflow-hidden bg-gray-100", hasMultiplePhotos && "touch-pan-y select-none")}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {post.photos.length > 0 ? (
          <div
            className="flex size-full transition-transform duration-300 ease-out"
            style={{ transform: `translateX(calc(-${photoIndex * 100}% + ${dragOffset}px))` }}
          >
            {post.photos.map((photo, index) => (
              <img
                key={photo.id}
                src={photo.url}
                alt={post.caption || `${post.location} - foto ${index + 1}`}
                className="size-full shrink-0 object-cover"
                draggable={false}
              />
            ))}
          </div>
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-gray-500">Foto indisponivel</div>
        )}
      </div>

      {post.photos.length > 1 ? (
        <div className="flex justify-center gap-2 border-b border-gray-100 py-3">
          {post.photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              aria-label={`Ver foto ${index + 1}`}
              onClick={() => goToPhoto(index)}
              className={cn("size-2.5 rounded-full", index === photoIndex ? "bg-brand-600" : "bg-gray-300")}
            />
          ))}
        </div>
      ) : null}

      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="tertiary"
            iconLeading={Heart}
            onPress={handleLike}
            isDisabled={!isAuthenticated || isPending}
            className={cn("px-2", post.likedByCurrentUser && "text-error-600 hover:text-error-700")}
          >
            {post.likesCount}
          </Button>
          <div className="inline-flex items-center gap-2 px-2 text-sm font-semibold text-gray-600">
            <MessageCircle className="size-4" />
            {post.comments.length}
          </div>
        </div>

        {post.caption ? (
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">{post.authorName}</span> {post.caption}
          </p>
        ) : null}

        <div className="space-y-2">
          {post.comments.map((item) => (
            <div key={item.id} className="flex gap-2 text-sm">
              <Avatar size="xs" src={item.authorAvatarUrl} initials={getInitials(item.authorName)} alt={item.authorName} />
              <p className="min-w-0 flex-1 text-gray-700">
                <span className="font-semibold text-gray-900">{item.authorName}</span> {item.content}
              </p>
            </div>
          ))}
        </div>

        <form className="flex gap-2 border-t border-gray-100 pt-3" onSubmit={handleComment}>
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Adicionar comentario..."
            disabled={!isAuthenticated || isPending}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 disabled:cursor-not-allowed disabled:bg-gray-50"
          />
          <Button type="submit" size="sm" iconLeading={Send} isDisabled={!isAuthenticated || isPending || !comment.trim()}>
            Enviar
          </Button>
        </form>

        {actionMessage ? <p className="text-sm text-error-600">{actionMessage}</p> : null}
      </div>
    </article>
  );
}

function LocationCaptureFields({
  disabled,
  initialLatitude = null,
  initialLongitude = null,
  resetKey,
}: {
  disabled: boolean;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  resetKey: React.Key;
}) {
  const [latitude, setLatitude] = React.useState(() => formatCoordinateInput(initialLatitude));
  const [longitude, setLongitude] = React.useState(() => formatCoordinateInput(initialLongitude));
  const [status, setStatus] = React.useState<string | null>(hasCoordinates(initialLatitude, initialLongitude) ? "Coordenadas adicionadas." : null);
  const [isLocating, setIsLocating] = React.useState(false);
  const hasLocation = Boolean(latitude && longitude);

  React.useEffect(() => {
    setLatitude(formatCoordinateInput(initialLatitude));
    setLongitude(formatCoordinateInput(initialLongitude));
    setStatus(hasCoordinates(initialLatitude, initialLongitude) ? "Coordenadas adicionadas." : null);
    setIsLocating(false);
  }, [initialLatitude, initialLongitude, resetKey]);

  function handleUseCurrentLocation() {
    setStatus(null);

    if (!("geolocation" in navigator)) {
      setStatus("Localizacao indisponivel neste navegador.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setStatus("Local atual adicionado.");
        setIsLocating(false);
      },
      () => {
        setStatus("Nao foi possivel obter sua localizacao.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
  }

  return (
    <div className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Coordenadas</p>
          <p className="truncate text-xs text-gray-500">{hasLocation ? `${latitude}, ${longitude}` : "Nenhuma coordenada adicionada."}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {hasLocation ? (
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              onPress={() => {
                setLatitude("");
                setLongitude("");
                setStatus(null);
              }}
              isDisabled={disabled || isLocating}
            >
              Remover
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            iconLeading={MapPin}
            onPress={handleUseCurrentLocation}
            isDisabled={disabled || isLocating}
          >
            {isLocating ? "Localizando..." : "Usar local atual"}
          </Button>
        </div>
      </div>
      {status ? <p className={cn("text-xs", status.includes("adicionado") || status.includes("adicionadas") ? "text-success-700" : "text-error-600")}>{status}</p> : null}
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatCoordinateInput(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(6) : "";
}

function hasCoordinates(latitude: number | null | undefined, longitude: number | null | undefined) {
  return typeof latitude === "number" && Number.isFinite(latitude) && typeof longitude === "number" && Number.isFinite(longitude);
}

function getMapNavigationUrl(latitude: number | null, longitude: number | null) {
  if (!hasCoordinates(latitude, longitude)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
