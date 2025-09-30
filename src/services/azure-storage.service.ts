import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";

enum StorageContainerName {
  AUDIO_FILES = "audio-files",
}

export interface AudioUploadParams {
  id: string;
  buffer: Buffer;
  contentType?: string;
}

export interface AudioUploadResult {
  url: string;
  blobName: string;
}

class AzureStorageService {
  private readonly blobServiceClient: BlobServiceClient;
  private audioFilesContainerClient: ContainerClient;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STR;
    if (!connectionString) {
      throw new Error(
        "AZURE_STORAGE_CONNECTION_STR environment variable is required"
      );
    }

    this.blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);
    this.audioFilesContainerClient = this.blobServiceClient.getContainerClient(
      StorageContainerName.AUDIO_FILES
    );
  }

  /**
   * Khởi tạo container cho audio files
   */
  async initializeAudioFilesContainer(): Promise<void> {
    console.log("Initializing audio files container...");

    const containerExists = await this.audioFilesContainerClient.exists();
    if (!containerExists) {
      await this.audioFilesContainerClient.createIfNotExists();
      await this.audioFilesContainerClient.setAccessPolicy("blob");
      this.audioFilesContainerClient =
        this.blobServiceClient.getContainerClient(
          StorageContainerName.AUDIO_FILES
        );
      console.log("Audio files container created successfully");
    }
  }

  /**
   * Upload audio file từ buffer
   */
  async uploadAudioFromBuffer(
    params: AudioUploadParams
  ): Promise<AudioUploadResult> {
    console.log(`Uploading audio file: ${params.id}`);

    await this.initializeAudioFilesContainer();

    try {
      const blobName = `tts_${params.id}.wav`;
      const blobBlockClient =
        this.audioFilesContainerClient.getBlockBlobClient(blobName);

      const uploadOptions = {
        blobHTTPHeaders: {
          blobContentType: params.contentType || "audio/wav",
        },
      };

      await blobBlockClient.upload(
        params.buffer,
        params.buffer.length,
        uploadOptions
      );

      const storageUrl = process.env.AZURE_STORAGE_URL;
      if (!storageUrl) {
        throw new Error("AZURE_STORAGE_URL environment variable is required");
      }

      const blobUrl = `${storageUrl}/${this.audioFilesContainerClient.containerName}/${blobName}`;

      console.log(`Audio file uploaded successfully: ${blobUrl}`);

      return {
        url: blobUrl,
        blobName: blobName,
      };
    } catch (error) {
      console.error("Failed to upload audio file:", error);
      throw new Error("Failed to upload audio file");
    }
  }

  /**
   * Xóa audio file
   */
  async deleteAudioFile(blobName: string): Promise<boolean> {
    console.log(`Deleting audio file: ${blobName}`);

    try {
      const blobClient = this.audioFilesContainerClient.getBlobClient(blobName);
      await blobClient.delete();
      console.log(`Audio file deleted successfully: ${blobName}`);
      return true;
    } catch (error) {
      console.error("Failed to delete audio file:", error);
      return false;
    }
  }

  /**
   * Kiểm tra audio file có tồn tại không
   */
  async audioFileExists(blobName: string): Promise<boolean> {
    try {
      const blobClient = this.audioFilesContainerClient.getBlobClient(blobName);
      return await blobClient.exists();
    } catch (error) {
      console.error("Failed to check audio file existence:", error);
      return false;
    }
  }

  /**
   * Lấy URL của audio file
   */
  getAudioFileUrl(blobName: string): string {
    const storageUrl = process.env.AZURE_STORAGE_URL;
    if (!storageUrl) {
      throw new Error("AZURE_STORAGE_URL environment variable is required");
    }

    return `${storageUrl}/${this.audioFilesContainerClient.containerName}/${blobName}`;
  }
}

// Export singleton instance
let azureStorageServiceInstance: AzureStorageService | null = null;

export function getAzureStorageService(): AzureStorageService {
  if (!azureStorageServiceInstance) {
    azureStorageServiceInstance = new AzureStorageService();
  }
  return azureStorageServiceInstance;
}

export default AzureStorageService;
