'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface NoteModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tempNote: string;
  setTempNote: (note: string) => void;
  onSaveNote: () => void;
}

export function NoteModal({
  isOpen,
  onOpenChange,
  tempNote,
  setTempNote,
  onSaveNote,
}: NoteModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Note to Item</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="e.g. Less sugar, extra ice, takeaway..."
            value={tempNote}
            onChange={e => setTempNote(e.target.value)}
            className="bg-background border-border"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSaveNote} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
