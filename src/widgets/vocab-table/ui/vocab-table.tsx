import { Notebook } from "@phosphor-icons/react/dist/ssr";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { PlayWordAudioButton } from "@/features/play-word-audio";
import type { VocabItem } from "@/entities/vocab-item";

export function VocabTable({ items }: { items: VocabItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <Notebook className="text-muted-foreground size-8" />
        <p className="text-sm">No words yet</p>
      </div>
    );
  }

  return (
    <Table className={items.length > 15 ? "[&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-background" : ""}>
      <TableHeader>
        <TableRow>
          <TableHead>Word</TableHead>
          <TableHead>Meaning</TableHead>
          <TableHead>Example</TableHead>
          <TableHead>Part of speech</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.word}</TableCell>
            <TableCell>{item.meaning}</TableCell>
            <TableCell className="text-muted-foreground">{item.example ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{item.partOfSpeech ?? "—"}</TableCell>
            <TableCell>
              <PlayWordAudioButton word={item.word} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
