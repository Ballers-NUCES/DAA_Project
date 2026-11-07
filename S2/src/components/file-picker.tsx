import { useRef } from "react"
import { CheckCircle2Icon, FileTextIcon, FolderOpenIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

interface FilePickerProps {
  id: string
  file: File | null
  fileHint: string
  disabled?: boolean
  onFileChange: (file: File | null) => void
}

const byteFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const fileSizeFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${byteFormatter.format(bytes)}\u00a0B`
  if (bytes < 1024 * 1024) return `${fileSizeFormatter.format(bytes / 1024)}\u00a0KB`
  return `${fileSizeFormatter.format(bytes / (1024 * 1024))}\u00a0MB`
}

export function FilePicker({ id, file, fileHint, disabled, onFileChange }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const browseButtonRef = useRef<HTMLButtonElement>(null)
  const descriptionId = `${id}-description`
  const openPicker = () => {
    if (!disabled) inputRef.current?.click()
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>Input File</FieldLabel>
      <InputGroup className="h-11 bg-background">
        <InputGroupAddon align="inline-start">
          <FileTextIcon className="size-4" aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          value={file?.name ?? ""}
          placeholder="Select a plain-text dataset…"
          readOnly
          disabled={disabled}
          tabIndex={-1}
          onClick={openPicker}
          className="cursor-pointer font-mono"
          aria-describedby={descriptionId}
        />
        {file && (
          <>
            <InputGroupAddon align="inline-end" className="text-success">
              <CheckCircle2Icon className="size-4" aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                variant="ghost"
                disabled={disabled}
                aria-label={`Clear ${file.name}`}
                onClick={() => {
                  onFileChange(null)
                  browseButtonRef.current?.focus()
                }}
              >
                <XIcon aria-hidden="true" />
              </InputGroupButton>
            </InputGroupAddon>
          </>
        )}
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            ref={browseButtonRef}
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={openPicker}
          >
            <FolderOpenIcon aria-hidden="true" />
            Browse
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".txt,text/plain"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          const nextFile = event.currentTarget.files?.[0] ?? null
          event.currentTarget.value = ""
          onFileChange(nextFile)
        }}
      />
      <FieldDescription id={descriptionId} className="text-xs break-words" aria-live="polite">
        {file ? `${file.name} · ${formatFileSize(file.size)} · Ready to run` : fileHint}
      </FieldDescription>
    </Field>
  )
}

interface FilesPickerProps {
  id: string
  files: File[]
  disabled?: boolean
  onFilesChange: (files: File[]) => void
}

export function FilesPicker({ id, files, disabled, onFilesChange }: FilesPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const chooseButtonRef = useRef<HTMLButtonElement>(null)
  const removeButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const descriptionId = `${id}-description`
  const totalBytes = files.reduce((total, file) => total + file.size, 0)
  const selectionLabel =
    files.length === 0
      ? ""
      : files.length === 1
        ? files[0].name
        : `${files.length} files selected`
  const openPicker = () => {
    if (!disabled) inputRef.current?.click()
  }

  const removeFile = (index: number) => {
    const focusTarget =
      index < files.length - 1
        ? removeButtonRefs.current[index + 1]
        : removeButtonRefs.current[index - 1]
    const buttonToFocus = focusTarget ?? chooseButtonRef.current
    buttonToFocus?.focus()
    onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>Input Files</FieldLabel>
      <InputGroup className="h-11 bg-background">
        <InputGroupAddon align="inline-start">
          <FileTextIcon className="size-4" aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          name={id}
          value={selectionLabel}
          placeholder="Choose one or more plain-text datasets…"
          autoComplete="off"
          readOnly
          disabled={disabled}
          tabIndex={-1}
          onClick={openPicker}
          className="cursor-pointer"
          aria-describedby={descriptionId}
        />
        {files.length > 0 && (
          <InputGroupAddon align="inline-end" className="text-success">
            <CheckCircle2Icon className="size-4" aria-hidden="true" />
          </InputGroupAddon>
        )}
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            ref={chooseButtonRef}
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={openPicker}
          >
            <FolderOpenIcon aria-hidden="true" />
            Choose Files
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".txt,text/plain"
        multiple
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          const nextFiles = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ""
          onFilesChange(nextFiles)
        }}
      />
      <FieldDescription id={descriptionId} className="text-xs" aria-live="polite">
        {files.length > 0
          ? `${formatFileSize(totalBytes)} across ${files.length} ${files.length === 1 ? "file" : "files"}`
          : "Select a single file or a batch. Each file must contain two decimal integers."}
      </FieldDescription>

      {files.length > 0 && (
        <ul className="mt-1 divide-y rounded-xl border bg-muted/20" aria-label="Selected Input Files">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex items-center gap-3 px-3 py-2.5 [content-visibility:auto] [contain-intrinsic-size:auto_44px]"
            >
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs" translate="no">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatFileSize(file.size)}
              </span>
              <Button
                ref={(node) => {
                  removeButtonRefs.current[index] = node
                }}
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 shrink-0"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => removeFile(index)}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  )
}
