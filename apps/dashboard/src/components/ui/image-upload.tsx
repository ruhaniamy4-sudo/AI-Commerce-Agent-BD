'use client';

import { useState } from 'react';
import { Button } from './button';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface ImageUploadProps {
    value: string[];
    onChange: (value: string[]) => void;
    disabled?: boolean;
    folder?: string;
    maxFiles?: number;
}

export function ImageUpload({
    value,
    onChange,
    disabled,
    folder = 'edutechs',
    maxFiles = 5
}: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false);

    const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            setIsUploading(true);
            const uploadedUrls: string[] = [];

            // Get signature
            const { timestamp, signature, apiKey, cloudName } = await apiClient.get<{
                timestamp: number;
                signature: string;
                apiKey: string;
                cloudName: string;
            }>('/api/upload/signature', { params: { folder } });

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('api_key', apiKey);
                formData.append('timestamp', timestamp.toString());
                formData.append('signature', signature);
                formData.append('folder', folder);

                const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error('Upload failed');
                }

                const data = await response.json();
                uploadedUrls.push(data.secure_url);
            }

            onChange([...value, ...uploadedUrls]);
        } catch (error) {
            console.error('Upload Error:', error);
            // Optional: Show toast error
        } finally {
            setIsUploading(false);
        }
    };

    const removeImage = (url: string) => {
        onChange(value.filter((current) => current !== url));
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
                {value.map((url) => (
                    <div
                        key={url}
                        className="relative h-[200px] w-[200px] rounded-md overflow-hidden border"
                    >
                        <div className="absolute top-2 right-2 z-10">
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={() => removeImage(url)}
                                disabled={disabled}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <Image
                            fill
                            src={url}
                            alt="Uploaded Image"
                            className="object-cover"
                        />
                    </div>
                ))}
            </div>
            {value.length < maxFiles && (
                <div className="flex items-center gap-4">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={disabled || isUploading}
                        onClick={() => document.getElementById('image-upload')?.click()}
                    >
                        {isUploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <ImagePlus className="h-4 w-4 mr-2" />
                        )}
                        Upload Image
                    </Button>
                    <input
                        id="image-upload"
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={onUpload}
                        disabled={disabled || isUploading}
                    />
                </div>
            )}
        </div>
    );
}
