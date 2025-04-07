import { useEffect, useCallback } from "react";
import { useProjectStore } from "../store/projectStore";
import logger from "../utils/logger";
import { FileData } from "../types/FileTypes";
import { ProcessingStatus } from "../types/projectStateTypes";
import { PROMPT_SECTIONS } from "../constants";
import { categorizeFile } from "../utils/formatUtils";

/**
 * Hook for managing IPC (Inter-Process Communication) with Electron main process
 */
export const useIpcManager = () => {
  const isElectron = window.electron !== undefined;

  // Get actions needed by the handlers
  const {
    setCurrentSelectedFolder,
    setAllFiles: setStoreAllFilesAction,
    setProcessingStatus: setStoreProcessingStatusAction,
  } = useProjectStore.getState();

  // --- IPC Handlers ---
  const handleFolderSelectedIPC = useCallback(
    (folderPath: string) => {
      if (typeof folderPath === "string") {
        logger.info(`IPC: folder-selected received: ${folderPath}`);
        setCurrentSelectedFolder(folderPath);
      } else {
        logger.error(`IPC: Invalid folder path received: ${folderPath}`);
        setStoreProcessingStatusAction({
          status: "error",
          message: "Invalid folder path received",
        });
      }
    },
    [setCurrentSelectedFolder, setStoreProcessingStatusAction]
  );

  const handleFileListDataIPC = useCallback(
    (receivedData: FileData[] | { files: FileData[] }) => {
      logger.info(`IPC: file-list-data received`);
      const filesArray = Array.isArray(receivedData)
        ? receivedData
        : receivedData.files;

      // Get current folder directly from store when data arrives
      const currentSelectedFolder =
        useProjectStore.getState().currentSelectedFolder;

      const categorizedFiles = filesArray.map((file) => ({
        ...file,
        // Trust the sectionId from the backend FIRST
        sectionId:
          file.sectionId ||
          categorizeFile(file, currentSelectedFolder, PROMPT_SECTIONS),
      }));

      // DEBUG LOGGING START
      logger.debug(
        "[IPC Manager] Received files count:",
        categorizedFiles.length
      );
      const overviewFileReceived = categorizedFiles.find(
        (f) => f.fileKind === "overview"
      );
      if (overviewFileReceived) {
        logger.debug(
          "[IPC Manager] Overview file data received:",
          JSON.stringify(overviewFileReceived, null, 2)
        );
      } else {
        logger.warn("[IPC Manager] Overview file not found in received data.");
      }
      // DEBUG LOGGING END

      logger.info(
        `IPC: Setting ${categorizedFiles.length} categorized files in store.`
      );
      setStoreAllFilesAction(categorizedFiles);
      setStoreProcessingStatusAction({
        status: "complete",
        message: `Loaded ${categorizedFiles.length} files`,
      });
    },
    [setStoreAllFilesAction, setStoreProcessingStatusAction]
  );

  const handleProcessingStatusIPC = useCallback(
    (status: ProcessingStatus) => {
      logger.info(
        `IPC: file-processing-status received: ${status.status} - ${status.message}`
      );
      setStoreProcessingStatusAction(status);
    },
    [setStoreProcessingStatusAction]
  );

  // --- Function to Send File Request ---
  const requestFileList = useCallback(
    (folderPath: string, forceRefresh: boolean = false) => {
      if (!isElectron || !folderPath) return;

      logger.info(
        `Handler: requestFileList for ${folderPath}, forceRefresh: ${forceRefresh}`
      );

      setStoreProcessingStatusAction({
        status: "processing",
        message: forceRefresh
          ? "Reloading folder..."
          : "Requesting folder data...",
      });

      window.electron.ipcRenderer.send("request-file-list", {
        path: folderPath,
        forceRefresh: forceRefresh,
      });
    },
    [isElectron, setStoreProcessingStatusAction]
  );

  // --- Effect to Setup/Cleanup Listeners ---
  useEffect(() => {
    logger.debug(`useIpcManager: Running useEffect for IPC listeners setup.`);
    if (!isElectron) return;

    // Use the memoized handlers defined above
    const localFolderHandler = handleFolderSelectedIPC;
    const localFileDataHandler = handleFileListDataIPC;
    const localStatusHandler = handleProcessingStatusIPC;

    logger.debug("useIpcManager: Setting up IPC listeners.");
    window.electron.ipcRenderer.on("folder-selected", localFolderHandler);
    window.electron.ipcRenderer.on("file-list-data", localFileDataHandler);
    window.electron.ipcRenderer.on(
      "file-processing-status",
      localStatusHandler
    );

    return () => {
      logger.debug("useIpcManager: Cleaning up IPC listeners.");
      window.electron.ipcRenderer.removeListener(
        "folder-selected",
        localFolderHandler
      );
      window.electron.ipcRenderer.removeListener(
        "file-list-data",
        localFileDataHandler
      );
      window.electron.ipcRenderer.removeListener(
        "file-processing-status",
        localStatusHandler
      );
    };
  }, [
    isElectron,
    handleFolderSelectedIPC,
    handleFileListDataIPC,
    handleProcessingStatusIPC,
  ]);

  // Return the function needed by useAppLogic
  return { requestFileList };
};
