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
  if (bytes < 1024) return `${byteFormatter.format(bytes)} B`
  if (bytes < 1024 * 1024) return `${fileSizeFormatter.format(bytes / 1024)} KB`
  return `${fileSizeFormatter.format(bytes / (1024 * 1024))} MB`
}

export function FilePicker({ id, file, fileHint, disabled, onFileChange }: FilePickerProps) {
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
          tabIndex={-1}
          className="cursor-default"
          aria-describedby={descriptionId}
        />
        {file && (
          <InputGroupAddon align="inline-end" className="text-success">
            <CheckCircle2Icon className="size-4" aria-hidden="true" />
          </InputGroupAddon>
        )}
        <InputGroupAddon align="inline-end">
          <InputGroupButton
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
      <FieldDescription id={descriptionId} className="text-xs">
        {file ? `${formatFileSize(file.size)} · Ready to run` : fileHint}
      </FieldDescription>
    </Field>
  )
}
