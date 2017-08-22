/**
 * @license
 * This file is part of Hacklily, a web-based LilyPond editor.
 * Copyright (C) 2017 - present Joshua Netterfield <joshua@nettek.ca>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301  USA
 */

export interface File {
  path: string;
  sha: string;
}

export async function ls(
    accessToken: string,
    repo: string,
    ref: string = 'master',
  ): Promise<File[]> {

  const headers: {} = {
    Authorization: `token ${accessToken}`,
  };

  // Note: sadly, cache: 'no-store' seems to be broken in Chrome with GH, so we use an
  // ugly cache_bust.
  const response: Response = await fetch(
    `https://api.github.com/repos/${repo}/contents?ref=${ref}&cache_bust=${new Date().getTime()}`,
    {
      headers,
    },
  );

  return (await response.json()).map((file: File) => ({
    path: file.path,
    sha: file.sha,
  }));
}

/**
 * Token that is thrown when we cannot save a file to GitHub because it already
 * exists, or was modified between when we got the SHA and when we made the save request.
 */
export class Conflict {
  message: string = 'Cannot save file because it conflicts with another file.';
}

/**
 * Token that is thrown when we cannot cat a file becasue it does not exist.
 */
export class FileNotFound {
  message: string = 'This file does not exist.';
}

export async function cat(
    accessToken: string,
    repo: string,
    filename: string,
    ref: string = 'master',
): Promise<{content: string, sha: string}> {

  const headers: {} = {
    Authorization: `token ${accessToken}`,
  };

  // Note: we should get more strict with our ref and get rid of the cache_bust
  const response: Response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filename}?ref=${ref}` +
      `&cache_bust=${new Date().getTime()}`,
    {
      headers,
    },
  );

  if (response.status === 404) {
    throw new FileNotFound();
  }

  const obj: {content: string, sha: string} = await response.json();

  return {
    content: atob(obj.content),
    sha: obj.sha,
  };
}

export async function write(
    accessToken: string,
    repo: string,
    filename: string,
    base64: string,
    sha?: string,
    ref: string = 'master',
): Promise<void> {
  const response: Response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filename}`,
    {
      body: JSON.stringify({
        branch: ref,
        content: base64,
        message: `Saved via ${process.env.HOMEPAGE || 'Hacklily'}`,
        sha: sha ? sha : undefined,
      }),
      headers: {
        Accept: 'application/json',
        Authorization: `token ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'PUT',
    },
  );

  if (response.status === 409) {
    throw new Conflict();
  }

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Status: ${response.statusText}`);
  }
}

export async function rm(
    accessToken: string,
    repo: string,
    filename: string,
    sha: string,
    ref: string = 'master',
): Promise<void> {
  const response: Response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filename}`,
    {
      body: JSON.stringify({
        branch: ref,
        message: `Saved via ${process.env.HOMEPAGE || 'Hacklily'}`,
        sha: sha ? sha : undefined,
      }),
      headers: {
        Accept: 'application/json',
        Authorization: `token ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'DELETE',
    },
  );

  if (response.status === 409) {
    throw new Conflict();
  }

  if (response.status !== 200) {
    throw new Error(`Status: ${response.statusText}`);
  }
}