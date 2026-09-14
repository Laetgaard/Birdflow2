/**
 * Who opens the image picker.
 *
 * The picker dialog lives once, next to the builder page's other dialogs;
 * anything that needs an image — a properties field, an empty slot on the
 * canvas, the element panel — asks for it here and gets the chosen value
 * back through its own callback.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { ImageValue } from '@shared/rendering/imageValue';

export type ImagePickerRequest = {
  /** Pre-fills the dialog (alt, focal point, crop) when re-picking. */
  value?: ImageValue | null;
  /** Shown as the dialog's subject, e.g. "Baggrundsbillede". */
  title?: string;
  onSelect: (value: ImageValue) => void;
};

export type ImagePickerApi = {
  open: (request: ImagePickerRequest) => void;
};

const ImagePickerContext = createContext<ImagePickerApi | null>(null);

export function ImagePickerProvider({ value, children }: { value: ImagePickerApi; children: ReactNode }) {
  return <ImagePickerContext.Provider value={value}>{children}</ImagePickerContext.Provider>;
}

/** Null outside the builder page (the published site and read-only previews). */
export function useImagePicker(): ImagePickerApi | null {
  return useContext(ImagePickerContext);
}
