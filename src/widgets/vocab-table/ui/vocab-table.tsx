import { Notebook } from "@phosphor-icons/react/dist/ssr";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { PlayWordAudioButton } from "@/features/play-word-audio";
import { EditVocabItemDialog } from "@/features/edit-vocab-item";
import { DeleteVocabItemButton } from "@/features/delete-vocab-item";
import type { VocabItem } from "@/entities/vocab-item";

export function VocabTable({ items }: { items: VocabItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-olive-light text-brand-olive-dark">
          <Notebook className="size-6" />
        </span>
        <p className="text-sm text-muted-foreground">No words yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-brand-sm">
      <Table
        className={
          items.length > 15
            ? "[&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-muted"
            : "[&_thead]:bg-muted"
        }
      >
        <TableHeader>
          <TableRow className="hover:bg-muted">
            <TableHead>Word</TableHead>
            <TableHead>Meaning</TableHead>
            <TableHead>Example</TableHead>
            <TableHead>Part of speech</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium text-foreground">{item.word}</TableCell>
              <TableCell>{item.meaning}</TableCell>
              <TableCell className="text-muted-foreground">{item.example ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{item.partOfSpeech ?? "—"}</TableCell>
              <TableCell className="flex items-center gap-1">
                <PlayWordAudioButton word={item.word} />
                <EditVocabItemDialog item={item} />
                <DeleteVocabItemButton itemId={item.id} word={item.word} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
