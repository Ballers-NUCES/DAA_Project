import { useRef } from "react"
import { CheckCircle2Icon, FolderOpenIcon } from "lucide-react"
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
  disabled?: boolean
  onFileChange: (file: File | null) => void
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FilePicker({ id, file, disabled, onFileChange }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const descriptionId = `${id}-description`
  const openPicker = () => {
    if (!disabled) inputRef.current?.click()
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>Input file</FieldLabel>
      <InputGroup className="h-11 bg-background">
        <InputGroupInput
          id={id}
          value={file?.name ?? ""}
          placeholder="Select a plain-text dataset"
          readOnly
          disabled={disabled}
          className="cursor-pointer"
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              openPicker()
            }
          }}
          aria-describedby={descriptionId}
        />
        {file && (
          <InputGroupAddon align="inline-end" className="text-success">
            <CheckCircle2Icon className="size-4" />
          </InputGroupAddon>
        )}
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={openPicker}
          >
            <FolderOpenIcon />
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
      <FieldDescription id={descriptionId} className="text-xs">
        {file
          ? `${formatFileSize(file.size)} · Ready to run`
          : "Choose cp01-cp10 or im01-im10. Files are assumed valid."}
      </FieldDescription>
    </Field>
  )
}
