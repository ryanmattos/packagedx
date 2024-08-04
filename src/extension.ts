import * as vscode from 'vscode';
import { Hover, MarkdownString } from 'vscode';

let PKGS_CACHE: Record<string, string> | undefined = {};

export function activate(context: vscode.ExtensionContext) {
   context.subscriptions.push(
      vscode.languages.registerHoverProvider('json', { provideHover })
   );
}

export function deactivate() {
   PKGS_CACHE = undefined;
}

const provideHover: (
   document: vscode.TextDocument,
   position: vscode.Position,
   token: vscode.CancellationToken
) => vscode.ProviderResult<Hover> = (document, position) => {
   if (vscode.window.activeTextEditor && !(new RegExp('^.*package(-lock)?.json$').test(vscode.window.activeTextEditor.document.fileName))) { return null; }
   
   const hoveredLine = document.lineAt(position.line);
   const isPackage = new RegExp(
      `"(?<key>dependencies|devDependencies)"\\s*:\\s*{[^}]*${hoveredLine.text
         .trim()
         .replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1')}[^}]*}`,
      's'
   ).exec(document.getText());

   if (!isPackage) {
      return null;
   }

   const pkg = hoveredLine.text.match(
      /^\s+"((@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*)"/
   )?.[1] as keyof typeof PKGS_CACHE;

   if (!pkg) { return null; }

   if (PKGS_CACHE?.[pkg]) {
      return new Hover(PKGS_CACHE?.[pkg]);
   }

   return new Promise(resolve => {
      vscode.workspace.fs
         .readFile(
            vscode.Uri.joinPath(
               vscode.workspace.workspaceFolders?.[0].uri!,
               `node_modules/${pkg}/package.json`
            )
         )
         .then(data => {
            const msg = message(decode(data));
            if (PKGS_CACHE) {
               PKGS_CACHE[pkg] = msg;
            }
            resolve(new Hover(new MarkdownString(msg)));
         }, () => resolve(new Hover(new MarkdownString(notFoundMessage(pkg)))));
   });
};

const message = (json: any) =>
   `${json.description}\n\n_Found version: \`v${json.version}\`_`;
const notFoundMessage = (pkg: string) => `_Package \`${pkg}\` not found_`;
const decode = (data: any) => JSON.parse(new TextDecoder().decode(data));
