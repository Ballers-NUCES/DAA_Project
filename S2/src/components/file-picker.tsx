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
import { fileNameFromPath, pickFiles } from "@/lib/backend"

interface FilesPickerProps {
  id: string
  files: string[]
  disabled?: boolean
  onFilesChange: (files: string[]) => void
}

export function FilesPicker({ id, files, disabled, onFilesChange }: FilesPickerProps) {
  const chooseButtonRef = useRef<HTMLButtonElement>(null)
  const removeButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const descriptionId = `${id}-description`
  const selectionLabel =
    files.length === 0
      ? ""
      : files.length === 1
        ? fileNameFromPath(files[0])
        : `${files.length} files selected`

  const openPicker = async () => {
    if (disabled) return
    const selected = await pickFiles(true, files[0]).catch(() => [])
    if (selected.length > 0) onFilesChange(selected)
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
          title={files.length === 1 ? files[0] : undefined}
          placeholder="Choose one or more plain-text datasets…"
          autoComplete="off"
          readOnly
          disabled={disabled}
          tabIndex={-1}
          onClick={() => void openPicker()}
          className="cursor-pointer"
          aria-describedby={descriptionId}
        />
        <InputGroupAddon align="inline-end">
          {files.length > 0 && (
            <CheckCircle2Icon className="size-4 text-success" aria-hidden="true" />
          )}
          <InputGroupButton
            ref={chooseButtonRef}
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => void openPicker()}
          >
            <FolderOpenIcon aria-hidden="true" />
            Choose Files
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription id={descriptionId} className="text-xs" aria-live="polite">
        {files.length > 0
          ? `${files.length} ${files.length === 1 ? "file" : "files"} ready to run`
          : "Select a single file or a batch. Each file must contain two decimal integers."}
      </FieldDescription>

      {files.length > 0 && (
        <ul className="mt-1 divide-y rounded-xl border bg-muted/20" aria-label="Selected Input Files">
          {files.map((file, index) => {
            const fileName = fileNameFromPath(file)
            return (
              <li
                key={file}
                className="flex items-center gap-3 px-3 py-2.5 [content-visibility:auto] [contain-intrinsic-size:auto_44px]"
              >
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span
                  className="min-w-0 flex-1 truncate font-mono text-xs"
                  title={file}
                  translate="no"
                >
                  {fileName}
                </span>
                <Button
                  ref={(node) => {
                    removeButtonRefs.current[index] = node
                  }}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 shrink-0"
                  aria-label={`Remove ${fileName}`}
                  disabled={disabled}
                  onClick={() => removeFile(index)}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </Field>
  )
}
