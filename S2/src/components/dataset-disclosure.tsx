import { ChevronDownIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DatasetRow } from "@/data/datasets"

interface DatasetDisclosureProps {
  title: string
  description: string
  rows: DatasetRow[]
}

export function DatasetDisclosure({ title, description, rows }: DatasetDisclosureProps) {
  return (
    <Collapsible>
      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <h3>
            <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="font-heading text-base font-medium">{title}</span>
              <span className="flex items-center gap-2">
                <Badge variant="secondary">{rows.length} Files</Badge>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-transform duration-200 group-data-panel-open:rotate-180"
                />
              </span>
            </CollapsibleTrigger>
          </h3>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Table>
              <TableCaption className="sr-only">{title}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">File</TableHead>
                  <TableHead>Input Size</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.file}>
                    <TableCell className="font-mono text-xs font-medium">{row.file}</TableCell>
                    <TableCell className="whitespace-normal text-xs tabular-nums">
                      {row.size}
                    </TableCell>
                    <TableCell className="whitespace-normal text-xs text-muted-foreground">
                      {row.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
