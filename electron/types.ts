export interface Website {
  id?: string;
  name: string;
  description: string;
  url: string;
}

export interface ExifFields {
  taken_at?: string | null;
  iso?: number | null;
  ev?: number | null;
  shutter?: string | null;
  aperture?: number | null;
  focal35?: number | null;
  lat?: number | null;
  lng?: number | null;
  altitude?: number | null;
  focal?: number | null;
  make?: string | null;
  model?: string | null;
  serial?: string | null;
}

export interface OpenPhotoResult {
  ok: boolean;
  canceled?: boolean;
  error?: string;
  path?: string;
  name?: string;
  size?: number;
  width?: number;
  height?: number;
  preview?: string;
  exif?: ExifFields;
}
