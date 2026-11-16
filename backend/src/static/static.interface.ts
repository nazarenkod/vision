import { PNGWithMetadata } from 'pngjs';

export interface Static {
  saveImage(type: 'screenshot' | 'diff' | 'baseline', imageBuffer: Buffer): Promise<string>;
  getImage(fileName: string): Promise<PNGWithMetadata>;
  getImageBuffer(fileName: string): Promise<Buffer | null>;
  copyImage(type: 'screenshot' | 'diff' | 'baseline', sourceImageName: string): Promise<string>;
  deleteImage(imageName: string): Promise<boolean>;
  getImageUrl(imageName: string): Promise<string>;
  // Non-image files kept next to the screenshots (UI trees, reports). Reading
  // and deleting them goes through getImageBuffer/deleteImage, which take any name.
  saveFile(fileName: string, buffer: Buffer, contentType: string): Promise<void>;
  copyFile(sourceName: string, targetName: string): Promise<void>;
}
