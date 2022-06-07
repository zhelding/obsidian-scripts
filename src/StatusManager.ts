import type moment from 'moment';
import type { Workspace, Vault } from 'obsidian';
import type { IMetaEditApi } from 'metaedit/src/IMetaEditApi';

declare global {
  interface Window {
    moment: typeof moment;
  }
  interface App {
    plugins: {
      plugins: {
        'metaedit': {
          api: IMetaEditApi;
        }
      }
    },
    workspace: Workspace,
    vault: Vault,
  }
}

declare const app: App;

const statusString: string = 'status';
const waitingString: string = 'waiting';
const startedString: string = 'started';
const waitingSinceString: string = 'waiting-since';
const completedString: string = 'completed';

const {
  createYamlProperty,
  getPropertiesInFile,
  getPropertyValue,
  update,
} = app.plugins.plugins.metaedit.api;

const activeFile = app.workspace.getActiveFile();

function getDateString(): string {
  return window.moment().format('YYYY-MM-DD');
}

async function hasProperty(key: string): Promise<boolean> {
  if (!activeFile) {
    return false;
  }

  const properties = await getPropertiesInFile(activeFile);
  return properties.some((property) => property.key === key);
}

/**
 * Adapted from MetaEdit:
 * https://github.com/chhoumann/MetaEdit/blob/41edf3b93c058c07bdae3a009090185075cb9bba/src/metaController.ts#L167-L178
 */
async function deleteProperties(keys: string[]): Promise<void> {
  if (!activeFile) {
    return;
  }

  const properties = await getPropertiesInFile(activeFile);
  const propertiesToDelete = properties.filter((property) => keys.includes(property.key));

  if (!propertiesToDelete) {
    return;
  }

  const fileContent = await app.vault.read(activeFile);
  const splitContent = fileContent.split('\n');

  const regexpToDelete = propertiesToDelete.map((property) => new RegExp(`^\\s*${property.key}:`));

  const indexesToDelete = regexpToDelete.map(
    (regexp) => splitContent.findIndex((line) => line.match(regexp)),
  );

  const newFileContent = splitContent.filter(
    (_, index) => !indexesToDelete.includes(index),
  ).join('\n');

  await app.vault.modify(activeFile, newFileContent);
}

async function setProperty(key: string, value: string): Promise<void> {
  if (!activeFile) {
    return;
  }

  if (!await hasProperty(key)) {
    await createYamlProperty(key, '', activeFile);
  }

  await update(key, value, activeFile);
}

async function deleteStatus(): Promise<void> {
  const propertiesToDelete: string[] = [
    statusString,
    startedString,
    waitingSinceString,
    completedString,
  ];

  await deleteProperties(propertiesToDelete);
}

async function setStatus(desiredStatus: string): Promise<void> {
  if (!activeFile) {
    return;
  }

  // If changing status from 'waiting': delete 'waiting-since' property
  if (await hasProperty(statusString)) {
    const currentStatus = await getPropertyValue(statusString, activeFile);
    if (currentStatus === waitingString && desiredStatus !== waitingString) {
      await deleteProperties([waitingSinceString]);
    }
  }

  await setProperty(statusString, desiredStatus);
}

async function setStatusSomeday(): Promise<void> {
  await setStatus('someday');
}

async function setStatusTodo(): Promise<void> {
  await setStatus('todo');
}

async function setStatusInProgress(): Promise<void> {
  await setStatus('in-progress');
  await setProperty(startedString, getDateString());
}

async function setStatusWaiting(): Promise<void> {
  await setStatus(waitingString);
  await setProperty(waitingSinceString, getDateString());
}

async function setStatusCompleted(): Promise<void> {
  await setStatus(completedString);
  await setProperty(completedString, getDateString());
}

export {
  deleteStatus,
  setStatusSomeday,
  setStatusTodo,
  setStatusInProgress,
  setStatusWaiting,
  setStatusCompleted,
};
