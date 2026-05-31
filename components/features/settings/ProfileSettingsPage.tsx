"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { deleteMyProfileAvatar, getMyProfile, updateMyProfile, uploadMyProfileAvatar } from "@/app/actions/profiles";
import { createClient } from "@/lib/supabase/client";

const splitFullName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return {
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
    };
};

export const ProfileSettingsPage = () => {
    const { addToast } = useToast();
    const router = useRouter();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [initialValues, setInitialValues] = React.useState({
        firstName: "",
        lastName: "",
        email: "",
        bio: "",
        avatarUrl: "",
    });
    const [formData, setFormData] = React.useState(initialValues);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isAvatarBusy, setIsAvatarBusy] = React.useState(false);

    React.useEffect(() => {
        let isMounted = true;

        async function loadProfile() {
            const response = await getMyProfile();

            if (!isMounted) return;

            if (response.success && response.data) {
                const { firstName, lastName } = splitFullName(response.data.full_name ?? "");
                const nextValues = {
                    firstName,
                    lastName,
                    email: response.data.email ?? "",
                    bio: response.data.bio ?? "",
                    avatarUrl: response.data.avatar_url ?? "",
                };

                setInitialValues(nextValues);
                setFormData(nextValues);
            } else if (!response.success) {
                addToast({
                    title: "Could not load profile",
                    description: response.error,
                    type: "error",
                });
            }

            setIsLoading(false);
        }

        loadProfile();

        return () => {
            isMounted = false;
        };
    }, [addToast]);

    const fullName = `${formData.firstName} ${formData.lastName}`.trim();

    const refreshProfileSession = React.useCallback(async () => {
        const supabase = createClient();
        await supabase.auth.refreshSession();
        router.refresh();
    }, [router]);

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();

        if (fullName.length < 2) {
            addToast({
                title: "Validation error",
                description: "Please enter your name before saving.",
                type: "error",
            });
            return;
        }

        setIsSaving(true);

        const result = await updateMyProfile({
            full_name: fullName,
            email: formData.email,
            bio: formData.bio,
            avatar_url: formData.avatarUrl,
        });

        setIsSaving(false);

        if (result.success) {
            const { firstName, lastName } = splitFullName(result.data.full_name ?? "");
            const nextValues = {
                firstName,
                lastName,
                email: result.data.email ?? formData.email,
                bio: result.data.bio ?? "",
                avatarUrl: result.data.avatar_url ?? "",
            };

            setInitialValues(nextValues);
            setFormData(nextValues);
            addToast({
                title: "Profile updated",
                description: "Your personal details were saved.",
                type: "success",
            });
            await refreshProfileSession();
        } else {
            addToast({
                title: "Could not save profile",
                description: result.error,
                type: "error",
            });
        }
    };

    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;

        const uploadForm = new FormData();
        uploadForm.append("avatar", file);
        setIsAvatarBusy(true);

        const result = await uploadMyProfileAvatar(uploadForm);

        setIsAvatarBusy(false);

        if (result.success) {
            const avatarUrl = result.data.avatar_url ?? "";
            setFormData(prev => ({ ...prev, avatarUrl }));
            setInitialValues(prev => ({ ...prev, avatarUrl }));
            addToast({
                title: "Avatar updated",
                description: "Your new profile photo is now active.",
                type: "success",
            });
            await refreshProfileSession();
        } else {
            addToast({
                title: "Could not update avatar",
                description: result.error,
                type: "error",
            });
        }
    };

    const handleDeleteAvatar = async () => {
        setIsAvatarBusy(true);

        const result = await deleteMyProfileAvatar();

        setIsAvatarBusy(false);

        if (result.success) {
            setFormData(prev => ({ ...prev, avatarUrl: "" }));
            setInitialValues(prev => ({ ...prev, avatarUrl: "" }));
            addToast({
                title: "Avatar removed",
                description: "Your profile photo was removed.",
                type: "success",
            });
            await refreshProfileSession();
        } else {
            addToast({
                title: "Could not remove avatar",
                description: result.error,
                type: "error",
            });
        }
    };

    const handleCancel = () => {
        setFormData(initialValues);
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Loading your profile details...</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="h-20 w-20 animate-pulse rounded-full bg-gray-100" />
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
                        <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
                    </div>
                    <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
                </CardContent>
            </Card>
        );
    }

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Update your photo and personal details here.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Avatar Section */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                        <Avatar
                            src={formData.avatarUrl}
                            alt={fullName || "Profile photo"}
                            size="xl"
                        />
                        <div className="space-y-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    isDisabled={isAvatarBusy}
                                    onPress={() => fileInputRef.current?.click()}
                                >
                                    {isAvatarBusy ? "Uploading..." : "Change avatar"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="tertiary"
                                    size="sm"
                                    isDisabled={isAvatarBusy || !formData.avatarUrl}
                                    onPress={handleDeleteAvatar}
                                    className="text-error-700 hover:text-error-800"
                                >
                                    Delete
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500">JPG, GIF, PNG or WebP. 1MB max.</p>
                        </div>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                        <Input
                            label="First name"
                            value={formData.firstName}
                            onChange={(event) => setFormData(prev => ({ ...prev, firstName: event.target.value }))}
                            isDisabled={isSaving}
                            required
                        />
                        <Input
                            label="Last name"
                            value={formData.lastName}
                            onChange={(event) => setFormData(prev => ({ ...prev, lastName: event.target.value }))}
                            isDisabled={isSaving}
                        />
                    </div>

                    <Input
                        label="Email address"
                        type="email"
                        value={formData.email}
                        onChange={(event) => setFormData(prev => ({ ...prev, email: event.target.value }))}
                        isDisabled={isSaving}
                        required
                    />

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Bio</label>
                        <TextArea
                            placeholder="Write a short introduction..."
                            value={formData.bio}
                            onChange={(value) => setFormData(prev => ({ ...prev, bio: value }))}
                            isDisabled={isSaving}
                            rows={4}
                        />
                        <p className="text-xs text-gray-500">Brief description for your profile. URLs are hyperlinked.</p>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
                    <Button type="button" variant="secondary" isDisabled={isSaving} onPress={handleCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" isDisabled={isSaving || isAvatarBusy}>
                        {isSaving ? "Saving..." : "Save changes"}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
};
