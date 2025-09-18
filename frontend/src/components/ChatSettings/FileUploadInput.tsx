import { Upload, X } from 'lucide-react';
import { useState } from 'react';

import { useChatInteract } from '@chainlit/react-client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { useUpload } from 'hooks/useUpload';

import type { FileSpec } from 'client-types/';
import { IInput } from 'types/Input';

import { InputStateHandler } from './InputStateHandler';

interface FileUploadInputProps extends IInput {
  setField?: (field: string, value: string[], shouldValidate?: boolean) => void;
  value?: string[];
  accept?: FileSpec['accept'];
  max_files?: number;
  max_size_mb?: number;
}

const FileUploadInput = ({
  description,
  disabled,
  hasError,
  id,
  label,
  tooltip,
  className,
  setField,
  value: _value = [],
  accept = { '*/*': [] },
  max_files = 1,
  max_size_mb = 2
}: FileUploadInputProps): JSX.Element => {
  const { uploadFile } = useChatInteract();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{id: string, name: string}[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fileSpec: FileSpec = {
    accept,
    max_files,
    max_size_mb
  };

  const onResolved = async (files: File[]) => {
    // Prevent duplicate uploads
    if (uploading) {
      return;
    }

    // Handle adding to existing files for multiple file support
    const newFiles = max_files > 1 ? [...selectedFiles, ...files] : files;

    // Ensure we don't exceed max_files limit
    const limitedFiles = newFiles.slice(0, max_files);

    setSelectedFiles(limitedFiles);
    setUploading(true);
    setError('');

    try {
      // Upload each file to the backend sequentially to avoid promise issues
      const uploadResults = [];
      for (const file of limitedFiles) {
        const upload = uploadFile(file, () => {}); // Returns {xhr, promise}
        const result = await upload.promise; // Await the actual promise
        uploadResults.push(result);
      }

      // Store uploaded file info using IDs from upload response
      const newUploadedFiles = uploadResults
        .filter((result) => result && result.id)
        .map((result, index) => ({
          id: result.id,
          name: limitedFiles[index].name
        }));

      setUploadedFiles(newUploadedFiles);

      // Store file IDs in form field
      const fileIds = newUploadedFiles.map((file) => file.id);
      setField?.(id, fileIds);

    } catch (error) {
      console.error('Upload error:', error);
      setError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }

    // Show warning if files were truncated
    if (newFiles.length > max_files) {
      setError(`Only the first ${max_files} files were selected. Maximum ${max_files} files allowed.`);
    }
  };

  const onError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const upload = useUpload({
    spec: fileSpec,
    onResolved,
    onError,
    options: { multiple: max_files > 1 }
  });

  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newUploadedFiles = uploadedFiles.filter((_, i) => i !== index);

    setSelectedFiles(newFiles);
    setUploadedFiles(newUploadedFiles);

    const fileIds = newUploadedFiles.map((file) => file.id);
    setField?.(id, fileIds);
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setUploadedFiles([]);
    setField?.(id, []);
    setError('');
  };

  if (!upload) return <></>;
  const { getRootProps, getInputProps } = upload;

  return (
    <InputStateHandler
      description={description}
      hasError={hasError || !!error}
      id={id}
      label={label}
      tooltip={tooltip}
      className={className}
    >
      <div className="space-y-2">
        <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
          <div
            {...getRootProps()}
            className={`flex items-center justify-center p-4 ${uploading || disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            <input {...getInputProps()} disabled={disabled || uploading} />
            <div className="text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {max_files > 1
                  ? 'Click to select multiple files or drag and drop'
                  : 'Click to select file or drag and drop'
                }
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {max_files > 1
                  ? `Up to ${max_files} files • ${max_size_mb}MB each`
                  : `Max ${max_size_mb}MB`
                }
              </p>
            </div>
          </div>
        </Card>

        {error && <div className="text-sm text-destructive">{error}</div>}

        {uploading && (
          <div className="text-sm text-muted-foreground">Uploading files...</div>
        )}

        {uploadedFiles.length > 0 && !uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Uploaded Files ({uploadedFiles.length}/{max_files}):
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            </div>
            <div className="space-y-1">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted rounded-md"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded successfully • ID: {file.id}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(index)}
                    className="h-auto p-1 ml-2"
                    title="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {selectedFiles.length >= max_files && (
              <p className="text-xs text-muted-foreground">
                Maximum number of files reached. Remove files to add more.
              </p>
            )}
          </div>
        )}
      </div>
    </InputStateHandler>
  );
};

export { FileUploadInput };
export type { FileUploadInputProps };
