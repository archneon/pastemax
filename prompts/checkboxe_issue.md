I have this Pastemax electron projects, which allows me to easily copy paste files to AI. First i use "Select Folder"
button and i have selected my Sveltekit project. Project tree is then listed in the left sidebar where you
can can view all directories and files. You can easily select/deslect checkbox in front of the directory (folder)
and it will automatically select or deselect all sub directories properly. But the issue is that it doesn't
if directory structure is deeper than two levels. Here is an example:

This is my Sveltekit project that i have imported into Pastemax.
There is 'src' directory, which has multiple directory levels, just like any other larger project :)

src
├── app.css
├── app.d.ts
├── app.html
├── hooks.server.ts
├── hooks.ts
├── lib
│ ├── index.ts
│ ├── paraglide
│ │ ├── messages
│ │ │ ├── hello_world.js
│ │ │ └── \_index.js
│ │ ├── messages.js
│ │ ├── registry.js
│ │ ├── runtime.js
│ │ └── server.js
│ └── server
│ └── db
│ ├── index.ts
│ └── schema.ts
└── routes
├── demo
│ ├── +page.svelte
│ └── paraglide
│ └── +page.svelte
├── +layout.svelte
└── +page.svelte

8 directories, 18 files

The problem is that when you click on the checkbox infront of the "src" directory it doesn't work. It seems like the reason is because it has more than two levels deep structure. Basically when i click on the "src" checkbox, the checkbox disappears, but it does not deslect any sub directories or files (which it should). If i click on the empty "src" checkbox again, checkbox remains empty (basically nothing happens), but it also has no effect on its sub directories or files.

The same issue occurs even if i click on the "lib" directory checkbox (src / lib). But it does work properly if i click on the "server" checkbox. Then it properly selects/deselects all sub dirs.

Can you review the code and explain what can be done to fix this issue please!
