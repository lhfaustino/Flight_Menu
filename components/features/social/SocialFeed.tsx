"use client";

import * as React from "react";
import { Heart, ImagePlus, MapPin, MessageCircle, RotateCcw, Send, UsersRound, X } from "lucide-react";
import { createSocialComment, createSocialPost, toggleSocialPostLike } from "@/app/actions/social";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, Modal, ModalOverlay } from "@/components/ui/Modal";
import { BRAZILIAN_STATES, SOCIAL_TAGS } from "@/lib/social-options";
import { cn } from "@/lib/utils";

export type SocialFeedPost = {
  id: string;
  authorName: string;
  authorAvatarUrl: string | null;
  caption: string;
  location: string;
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
};

export function SocialFeed({ posts, isAuthenticated }: SocialFeedProps) {
  const [stateFilter, setStateFilter] = React.useState("all");
  const [tagFilter, setTagFilter] = React.useState("all");
  const [message, setMessage] = React.useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = React.useState(false);
  const [isPosting, startPostTransition] = React.useTransition();

  const filteredPosts = React.useMemo(
    () =>
      posts.filter((post) => {
        if (stateFilter !== "all" && post.brazilianState !== stateFilter) return false;
        if (tagFilter !== "all" && post.tag !== tagFilter) return false;
        return true;
      }),
    [posts, stateFilter, tagFilter],
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
        setMessage("Publicacao criada.");
        setIsComposerOpen(false);
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
          {filteredPosts.length} de {posts.length} publicacoes
        </p>
      </section>

      <section className="grid gap-5">
        {filteredPosts.length > 0 ? (
          filteredPosts.map((post) => <SocialPostCard key={post.id} post={post} isAuthenticated={isAuthenticated} />)
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
  onOpenChange,
  onSubmit,
}: {
  isOpen: boolean;
  isPosting: boolean;
  isAuthenticated: boolean;
  message: string | null;
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

function SocialPostCard({ post, isAuthenticated }: { post: SocialFeedPost; isAuthenticated: boolean }) {
  const [photoIndex, setPhotoIndex] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0);
  const touchStartX = React.useRef<number | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const hasMultiplePhotos = post.photos.length > 1;

  function handleLike() {
    setActionMessage(null);
    startTransition(async () => {
      const result = await toggleSocialPostLike(post.id);
      if (!result.success) setActionMessage(result.error);
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
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{post.tag}</span>
          <p className="mt-1 text-xs text-gray-500">{formatDateTime(post.createdAt)}</p>
        </div>
      </header>

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

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
