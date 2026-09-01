'use client';

import { useId, useState } from 'react';
import { Button } from './button';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { SafeProductImage } from './safe-product-image';

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
    folder = 'products',
    maxFiles = 5
}: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const inputId = useId();

    const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            setError('');
            const selected = [...files].slice(0, Math.max(0, maxFiles - value.length));
            if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.type))) throw new Error('Choose a JPG, PNG, WebP, GIF, or AVIF image.');
            if (selected.some((file) => file.size > 8_000_000)) throw new Error('Each image must be 8 MB or smaller.');

            setIsUploading(true);
            const uploadedUrls: string[] = [];

            for (const file of selected) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('purpose', folder);
                const data = await apiClient.post<{ url: string }>('/api/upload/image', formData);
                uploadedUrls.push(data.url);
            }

            onChange([...value, ...uploadedUrls]);
        } catch (error) {
            console.error('Upload Error:', error);
            setError(error instanceof Error ? error.message : 'Image upload failed. Please try again.');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const removeImage = (url: string) => {
        onChange(value.filter((current) => current !== url));
    };

    const makePrimary = (index: number) => onChange([value[index], ...value.filter((_url, current) => current !== index)]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
                {value.map((url, index) => (
                    <div
                        key={`${url}-${index}`}
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
                        <SafeProductImage src={url} alt={`Product image ${index + 1}`} />
                        <div className="absolute bottom-2 left-2 z-10">
                            {index === 0 ? <span className="rounded-full bg-background/90 px-2 py-1 text-xs font-medium">Primary</span> : <Button type="button" variant="secondary" size="sm" onClick={() => makePrimary(index)} disabled={disabled}>Make primary</Button>}
                        </div>
                    </div>
                ))}
            </div>
            {value.length < maxFiles && (
                <div className="flex items-center gap-4">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={disabled || isUploading}
                        onClick={() => document.getElementById(inputId)?.click()}
                    >
                        {isUploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <ImagePlus className="h-4 w-4 mr-2" />
                        )}
                        Upload Image
                    </Button>
                    <input
                        id={inputId}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                        className="hidden"
                        onChange={onUpload}
                        disabled={disabled || isUploading}
                    />
                </div>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
    );
}
