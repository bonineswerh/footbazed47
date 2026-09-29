// ─── SVG ICONS (Heroicons style) ───
const I={
  close:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" d="m6 6 12 12M18 6 6 18"/></svg>`,
  plus:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>`,
  home:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.955-8.955a1.126 1.126 0 0 1 1.59 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>`,
  football:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>`,
  feed:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3z"/></svg>`,
  trophy:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.996.078-1.927.228-2.25.346v2.168A2.75 2.75 0 0 0 5.25 9.5m0-5.264V4.5h13.5v-.264m0 0c.996.078 1.927.228 2.25.346v2.168A2.75 2.75 0 0 1 18.75 9.5m0-5.264V4.5"/></svg>`,
  users:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0z"/></svg>`,
  profile:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0A17.93 17.93 0 0 1 12 21.75c-2.676 0-5.216-.584-7.5-1.632Z"/></svg>`,
  bell:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg>`,
  star:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5z"/></svg>`,
  heart:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>`,
  chat:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zM12 21a9 9 0 1 0-7.065-3.438L3 21l3.438-1.935A8.962 8.962 0 0 0 12 21z"/></svg>`,
  search:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z"/></svg>`,
  calendar:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>`,
  fire:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18z"/></svg>`,
  globe:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"/></svg>`,
  copy:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"/></svg>`,
  share:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/></svg>`,
  send:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12zm0 0h7.5"/></svg>`,
  inbox:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-17.5 0V6.108c0-1.135.845-2.098 1.976-2.192a48.424 48.424 0 0 1 11.048 0c1.131.094 1.976 1.057 1.976 2.192V13.5"/></svg>`,
  outbox:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7.875 14.25l1.214 1.942a2.25 2.25 0 001.908 1.058h2.006c.776 0 1.497-.4 1.908-1.058l1.214-1.942M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3"/></svg>`,
  sparkle:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456z"/></svg>`,
  save:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>`,
  link:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/></svg>`,
  edit:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/></svg>`,
  settings:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.661.84.076.034.151.07.225.108.33.167.722.143 1.03-.067l1.058-.72a1.125 1.125 0 0 1 1.45.12l1.833 1.833c.39.39.44 1.002.12 1.45l-.72 1.058c-.21.308-.234.7-.067 1.03.038.074.074.149.108.225.154.348.466.598.84.661l1.281.213c.542.09.94.56.94 1.11v2.593c0 .55-.398 1.02-.94 1.11l-1.281.213a1.125 1.125 0 0 0-.84.661 5.5 5.5 0 0 1-.108.225c-.167.33-.143.722.067 1.03l.72 1.058c.32.448.27 1.06-.12 1.45l-1.833 1.833a1.125 1.125 0 0 1-1.45.12l-1.058-.72c-.308-.21-.7-.234-1.03-.067a5.5 5.5 0 0 1-.225.108 1.125 1.125 0 0 0-.661.84l-.213 1.281c-.09.542-.56.94-1.11.94h-2.593c-.55 0-1.02-.398-1.11-.94l-.213-1.281a1.125 1.125 0 0 0-.661-.84 5.5 5.5 0 0 1-.225-.108c-.33-.167-.722-.143-1.03.067l-1.058.72a1.125 1.125 0 0 1-1.45-.12l-1.833-1.833a1.125 1.125 0 0 1-.12-1.45l.72-1.058c.21-.308.234-.7.067-1.03a5.5 5.5 0 0 1-.108-.225 1.125 1.125 0 0 0-.84-.661l-1.281-.213a1.125 1.125 0 0 1-.94-1.11v-2.593c0-.55.398-1.02.94-1.11l1.281-.213c.374-.063.686-.313.84-.661.034-.076.07-.151.108-.225.167-.33.143-.722-.067-1.03l-.72-1.058a1.125 1.125 0 0 1 .12-1.45l1.833-1.833a1.125 1.125 0 0 1 1.45-.12l1.058.72c.308.21.7.234 1.03.067.074-.038.149-.074.225-.108.348-.154.598-.466.661-.84l.213-1.281Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>`,
  photo:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0z"/></svg>`,
  chart:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125z"/></svg>`,
  target:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 2.25V4.5m0 15v2.25M2.25 12H4.5m15 0h2.25"/></svg>`,
  dashboard:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75h6.5v6.5h-6.5v-6.5Zm10 0h6.5v6.5h-6.5v-6.5Zm-10 10h6.5v6.5h-6.5v-6.5Zm10 0h6.5v6.5h-6.5v-6.5Z"/></svg>`,
  sync:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992V4.356m-.97 4.096A9 9 0 1 0 21 12m-13.023 2.652H2.985v4.992m.97-4.096A9 9 0 0 0 3 12"/></svg>`,
  refresh:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992V4.356m-.97 4.096A9 9 0 1 0 21 12"/></svg>`,
  download:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4.5 19.5h15"/></svg>`,
  pulse:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12h4l2.5-6 5 12 2.5-6h4"/></svg>`,
  shield:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3 4.5 6v5.25c0 4.5 3 7.875 7.5 9.75 4.5-1.875 7.5-5.25 7.5-9.75V6L12 3Z"/><path stroke-linecap="round" stroke-linejoin="round" d="m9 12 2 2 4-4"/></svg>`,
  check:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 4.5 4.5L19.5 6.75"/></svg>`,
  logout:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H5.75A1.75 1.75 0 0 0 4 7.75v8.5C4 17.216 4.784 18 5.75 18H10m4-3 3-3m0 0-3-3m3 3H9"/></svg>`,
  chevron:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m7.5 9.75 4.5 4.5 4.5-4.5"/></svg>`,
};
function ico(name,size){return(I[name]||'').replace('class="ico"',`class="ico" style="width:${size||16}px;height:${size||16}px"`);}

const DERBY=[{h:'Зенит',a:'Спартак'},{h:'Реал',a:'Барселона'},{h:'Ман Сити',a:'Ливерпуль'},{h:'Ювентус',a:'Милан'},{h:'Бавария',a:'Дортмунд'},{h:'Арсенал',a:'Тоттенхэм'}];
const AVCOLORS=['av-0','av-1','av-2','av-3','av-4','av-5','av-6','av-7'];
let CU=null,CP='home';
let MF='all',ML='all',FT='list';
let chatMID=null,mdID=null,viewUID=null;
let routeApplying=false;
let routeVersion=0,profileVersion=0,leaderboardVersion=0,chatVersion=0,chatSending=false;
window.addEventListener('fbz:session-change',()=>{
  profileVersion++;leaderboardVersion++;chatVersion++;routeVersion++;
  window.FBZCommunity?.resetSession();
  window.FBZNotifications?.resetSession();
  window.FBZProfileEditor?.resetSession();
  document.querySelectorAll('.overlay.on').forEach(overlay=>window.FBZOverlay?.close(overlay.id,false));
  ['profileW','chatBody','mdC','clubC','playerC','competitionC'].forEach(id=>document.getElementById(id)?.replaceChildren());
  if(CP!=='home')go('home');
});
function ensureFeatureModule(options){return window.FBZFeatures.load(options);}

function ensureAdminModule(){
  return ensureFeatureModule({key:'admin',styleId:'adminStyles',style:'admin.css?v=45',script:'js/admin.js?v=46',ready:()=>window.FBZAdmin});
}
function ensureEntitiesModule(){
  return ensureFeatureModule({key:'entities',styleId:'entityStyles',style:'css/entities.css?v=56',script:'js/entities.js?v=56',ready:()=>window.FBZEntities});
}
function ensureFeedModule(){
  return ensureFeatureModule({key:'feed',styleId:'feedStyles',style:'css/feed.css?v=57',script:'js/feed.js?v=55',ready:()=>window.FBZFeed});
}
function ensureMessagesModule(){
  return ensureFeatureModule({key:'messages',styleId:'messageStyles',style:'css/messages.css?v=6',script:'js/messages.js?v=5',ready:()=>window.FBZMessages});
}
function ensureSearchModule(){
  return ensureFeatureModule({key:'search',script:'js/search.js?v=56',ready:()=>window.FBZSearch});
}

function openGlobalSearch(){
  window.FBZAccount?.close();
  ensureSearchModule().then(search=>{
    search.init();
    search.open();
  }).catch(()=>{});
}

function openFriendChat(friendId){
  if(!CU){openAuth();return;}
  ensureMessagesModule().then(messages=>messages.openFriend(friendId)).catch(()=>{});
}
function forwardRating(ratingId){
  if(!CU){openAuth();return;}
  ensureMessagesModule().then(messages=>messages.pickFriend(Number(ratingId))).catch(()=>{});
}

function scheduleHomeFeed(){
  const target=document.getElementById('homeF');
  if(!target)return;
  const load=()=>ensureFeedModule().then(feed=>feed.loadHome()).catch(()=>{});
  if(!('IntersectionObserver'in window)){load();return;}
  const observer=new IntersectionObserver(entries=>{
    if(!entries.some(entry=>entry.isIntersecting))return;
    observer.disconnect();
    load();
  },{rootMargin:'320px 0px'});
  observer.observe(target);
}

function avColor(str){let h=0;for(let c of(str||'x'))h=(h<<5)-h+c.charCodeAt(0);return AVCOLORS[Math.abs(h)%8];}

async function init(){
  window.FBZAppearance?.init();
  document.getElementById('skipContent')?.addEventListener('click',event=>{event.preventDefault();const page=document.querySelector('.page.on');page?.setAttribute('tabindex','-1');page?.focus();});
  if(!Number.isInteger(history.state?.fbzIndex))history.replaceState({...history.state,fbzIndex:0},'',location.href);
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||!(event.ctrlKey||event.metaKey)||event.key.toLocaleLowerCase('en-US')!=='k')return;
    event.preventDefault();
    openGlobalSearch();
  });
  if(!window.sb){
    const local=['localhost','127.0.0.1'].includes(window.location.hostname);
    const message=local
      ?'Локальная среда не подключена к отдельной базе разработки.'
      :'Сервис данных временно недоступен. Обновите страницу немного позже.';
    const heroText=document.querySelector('.hero p');
    const heroButtons=document.getElementById('heroBtns');
    if(heroText)heroText.textContent=message;
    if(heroButtons)heroButtons.innerHTML='<div class="boot-error" role="alert">FOOTBAZED запущен в безопасном режиме без подключения к данным.</div>';
    console.error('Application bootstrap blocked:',window.FBZ_BOOT_ERROR||'unknown_configuration_error');
    setupReveal();injectIcons();
    return;
  }
  try{
    const{data:{session},error}=await sb.auth.getSession();
    if(error)throw error;
    if(session)await onLogin(session.user);
    else onLogout();
    sb.auth.onAuthStateChange((event,nextSession)=>{
      if(event==='INITIAL_SESSION')return;
      setTimeout(async()=>{
        try{
          if(nextSession?.user){
            await onLogin(nextSession.user);
            if(event==='PASSWORD_RECOVERY')openPasswordUpdate();
          }
          else onLogout();
        }catch(error){
          console.warn('Auth state error:',error);
          onLogout();
        }
      },0);
    });
  }catch(e){console.warn('Auth init error:',e);}
  const initialLoads=[loadHomeM()];
  if(!CU)initialLoads.push(loadHeroStats());
  Promise.allSettled(initialLoads).then(results=>{
    results.filter(result=>result.status==='rejected').forEach(result=>console.warn('Initial load error:',result.reason));
  });
  scheduleHomeFeed();
  setupReveal();injectIcons();
  const chatS=document.getElementById('chatS');
  const chatI=document.getElementById('chatI');
  if(chatS)chatS.onclick=sendChat;
  if(chatI)chatI.onkeypress=e=>{if(e.key==='Enter')sendChat();};
  window.addEventListener('hashchange',applyRouteFromLocation);
  window.addEventListener('popstate',applyRouteFromLocation);
  const inv=new URLSearchParams(window.location.search).get('invite');
  if(inv)setTimeout(()=>handleInvite(inv),800);
  if(window.location.hash||!['/','/index.html'].includes(window.location.pathname))setTimeout(applyRouteFromLocation,100);
}

function renderNav(){
  const nr=document.getElementById('navRight');
  const hb=document.getElementById('heroBtns');
  document.body.classList.toggle('signed-in',Boolean(CU));
  if(CU){
    const n=CU.username||CU.email?.split('@')[0]||'U';
    const safeName=esc(n);
    const cls=avColor(n);
    const safeAvatar=safeImageUrl(CU.avatar_url);
    const navAv=safeAvatar?`<img src="${safeAvatar}" style="width:32px;height:32px;border-radius:8px;object-fit:cover" alt="">`:`<div class="nav-av ${cls}">${esc(n[0].toUpperCase())}</div>`;
    const adminItem=CU.is_admin?`<button type="button" role="menuitem" onclick="FBZAccount.close();go('admin')">${ico('dashboard',17)}<span><b>Админ-панель</b><small>Управление платформой</small></span></button>`:'';
    nr.innerHTML=`
      <button class="notif-btn header-icon-button" id="notifBtn" type="button" onclick="toggleNotif()" aria-label="Уведомления" aria-controls="notifPanel" aria-expanded="false">${ico('bell',18)}<span class="notif-badge" id="notifBadge"></span></button>
      <button class="header-icon-button header-settings" type="button" onclick="openSettings()" aria-label="Настройки" title="Настройки">${ico('settings',18)}</button>
      <div class="account-shell">
        <button class="account-trigger" id="accountBtn" type="button" onclick="toggleAccountMenu()" aria-haspopup="menu" aria-expanded="false" aria-controls="accountMenu">${navAv}<span class="nav-uname">${safeName}</span>${ico('chevron',14)}</button>
        <div class="account-menu" id="accountMenu" role="menu" aria-hidden="true">
          <div class="account-menu-head">${navAv}<div><b>${safeName}</b><small>${esc(CU.email||'')}</small></div></div>
          <div class="account-menu-items">
            <button type="button" role="menuitem" onclick="FBZAccount.close();go('profile')">${ico('users',17)}<span><b>Мой профиль</b><small>Оценки и статистика</small></span></button>
            ${adminItem}
            <button type="button" role="menuitem" onclick="FBZAccount.close();openSettings()">${ico('settings',17)}<span><b>Настройки</b><small>Тема и данные аккаунта</small></span></button>
          </div>
          <button class="account-logout" type="button" role="menuitem" onclick="FBZAccount.close();doLogout()">${ico('logout',17)}<span>Выйти</span></button>
        </div>
      </div>`;
    if(hb)hb.innerHTML=`<button class="btn btn-l" onclick="go('matches')">Смотреть матчи →</button>`;
  }else{
    nr.innerHTML=`<button class="nbtn nbtn-lime" onclick="openAuth()">Войти</button>`;
    if(hb)hb.innerHTML=`<button class="btn btn-l" onclick="openRegister()">Начать свой дневник</button><button class="btn btn-g" onclick="go('matches')">Посмотреть матчи</button>`;
  }
  window.FBZHome?.sync(CU);
}

function goOwnProfile(){
  if(!CU){openAuth();return;}
  go('profile',{uid:CU.id});
}

function refreshHomeDashboard(){window.FBZHome?.sync(CU);}

function go(p,d){
  if(p==='admin'&&!CU?.is_admin){toast('Только для администратора','err');return;}
  const page=document.getElementById(`page-${p}`);
  if(!page)return;
  routeVersion++;
  window.FBZProfileEditor?.resetSession();
  document.querySelectorAll('.page').forEach(e=>e.classList.remove('on'));
  page.classList.add('on');
  document.querySelectorAll('.nav-link').forEach(l=>{l.classList.remove('active');l.removeAttribute('aria-current');});
  const lk=document.querySelector(`.nav-link[onclick*="'${p}'"]`);
  if(lk){lk.classList.add('active');lk.setAttribute('aria-current','page');}
  CP=p;window.scrollTo({top:0,behavior:'instant'});closeNotif();window.FBZAccount?.close();
  page.setAttribute('tabindex','-1');
  page.focus({preventScroll:true});
  // Update mobile nav
  document.querySelectorAll('.mob-nav-item').forEach(b=>{b.classList.remove('active');b.removeAttribute('aria-current');});
  const mn=document.getElementById(`mn-${p}`);if(mn){mn.classList.add('active');mn.setAttribute('aria-current','page');}
  window.FBZSEO?.setStatic(p);
  if(!routeApplying)syncRoute(p,d);
  if(p==='matches')loadM();
  else if(p==='home')refreshHomeDashboard();
  else if(p==='feed')ensureFeedModule().then(feed=>{if(CP==='feed')feed.open(d?.ratingId);}).catch(()=>{});
  else if(p==='leaderboard')loadLB();
  else if(p==='profile'){viewUID=d?.uid||CU?.id;loadProfile(viewUID);}
  else if(p==='md'){mdID=d?.mid;loadMD(d?.mid);}
  else if(['club','player','competition'].includes(p))loadEntityRoute(p,d?.id);
  else if(p==='chat'){chatMID=d?.mid;document.getElementById('chatTitle').textContent=d?.title||'Чат';loadChat(d?.mid);}
  else if(p==='friends')loadFriendsTab(FT);
  else if(p==='admin')ensureAdminModule().then(admin=>{if(CP==='admin')admin.mount();}).catch(()=>{});
}
function loadEntityRoute(page,id){
  const version=routeVersion,target=document.getElementById(`${page}C`);
  target.innerHTML='<div class="loading" role="status"><div class="spin"></div><span class="sr-only">Загрузка раздела</span></div>';
  ensureEntitiesModule().then(entities=>{
    if(version!==routeVersion||CP!==page)return;
    entities[{club:'loadClub',player:'loadPlayer',competition:'loadCompetition'}[page]](id);
  }).catch(()=>{
    if(version!==routeVersion||CP!==page)return;
    target.innerHTML='<div class="empty-state"><strong>Не удалось загрузить раздел</strong><p>Проверьте соединение и повторите попытку.</p><button class="btn btn-g" type="button">Повторить</button></div>';
    target.querySelector('button').onclick=()=>loadEntityRoute(page,id);
  });
}
function goBack(){
  if(Number(history.state?.fbzIndex)>0){history.back();return;}
  if(CP==='chat'&&chatMID){go('md',{mid:chatMID});return;}
  go(['md','club','player','competition'].includes(CP)?'matches':'home');
}

function syncRoute(p,d){
  let path='/';
  if(p==='profile'&&(d?.uid||CU?.id))path=`/profile/${encodeURIComponent(d?.uid||CU.id)}`;
  else if(p==='md'&&d?.mid)path=`/match/${encodeURIComponent(d.mid)}`;
  else if(p==='club'&&d?.id)path=`/club/${encodeURIComponent(d.id)}`;
  else if(p==='player'&&d?.id)path=`/player/${encodeURIComponent(d.id)}`;
  else if(p==='competition'&&d?.id)path=`/competition/${encodeURIComponent(d.id)}`;
  else if(p==='chat'&&d?.mid)path=`/match/${encodeURIComponent(d.mid)}/chat`;
  else if(p==='leaderboard')path='/discover';
  else if(['matches','feed','friends','admin'].includes(p))path=`/${p}`;
  const next=`${path}${window.location.search}`;
  const current=`${window.location.pathname}${window.location.search}${window.location.hash}`;
  if(next!==current)history.pushState({fbzIndex:(Number(history.state?.fbzIndex)||0)+1},'',next);
}

function applyRouteFromLocation(){
  const hashRoute=window.location.hash.replace(/^#/,'');
  const pathRoute=window.location.pathname.replace(/^\/+|\/+$/gu,'');
  const raw=hashRoute||pathRoute;
  if(!raw||raw==='index.html'||raw==='home'){
    if(CP!=='home'){
      routeApplying=true;
      try{go('home');}finally{routeApplying=false;}
    }
    return;
  }
  const [type,encodedValue,section]=raw.split('/');
  let value;
  try{value=encodedValue?decodeURIComponent(encodedValue):'';}catch{value='';}
  routeApplying=true;
  try{
    if(type==='profile'&&value)go('profile',{uid:value});
    else if(type==='match'&&value&&section==='chat')go('chat',{mid:value,title:'Чат матча'});
    else if(type==='match'&&value)go('md',{mid:value});
    else if(type==='club'&&value)go('club',{id:Number(value)});
    else if(type==='player'&&value)go('player',{id:Number(value)});
    else if((type==='competition'||type==='league')&&value)go('competition',{id:Number(value)});
    else if(type==='discover')go('leaderboard');
    else if(['matches','feed','leaderboard','friends','admin'].includes(type))go(type);
    else{go('home');toast('Не удалось открыть эту ссылку','err');}
  }finally{
    routeApplying=false;
  }
}

async function copyText(value,successLabel='Скопировано'){
  try{
    await navigator.clipboard.writeText(value);
    toast(successLabel,'ok');
    return true;
  }catch(error){
    console.warn('Clipboard error:',error);
    toast('Не удалось скопировать','err');
    return false;
  }
}

function copyAppLink(route,label='Ссылка'){
  const url=new URL(String(route||'/'),window.location.origin).href;
  copyText(url,`${label} скопирована`);
}

async function loadHeroStats(){
  const[{count:u},{count:r},{count:m}]=await Promise.all([
    sb.from('users').select('id',{count:'exact',head:true}),
    sb.from('ratings').select('id',{count:'exact',head:true}),
    sb.from('matches').select('id',{count:'exact',head:true})
  ]);
  anim('hU',u||0);anim('hR',r||0);anim('hM',m||0);
}
function anim(id,t){
  const el=document.getElementById(id);if(el)el.textContent=Number(t||0).toLocaleString('ru-RU');
}

// ─── FOOTBALL OVERVIEW ───
async function loadLB(){
  const token=++leaderboardVersion,route=routeVersion,user=CU?.id;
  document.getElementById('statisticsRoot').innerHTML='<div class="loading" role="status"><div class="spin"></div><span class="sr-only">Загрузка обзора</span></div>';
  try{
    const [statistics]=await Promise.all([ensureFeatureModule({key:'statistics',script:'js/statistics.js?v=2',ready:()=>window.FBZStatistics}),ensureExploreModule()]);
    if(token===leaderboardVersion&&route===routeVersion&&user===CU?.id&&CP==='leaderboard')return statistics.mount();
  }catch(error){if(token===leaderboardVersion&&CP==='leaderboard')document.getElementById('statisticsRoot').innerHTML='<div class="empty-state"><strong>Не удалось загрузить обзор</strong><button class="btn btn-g" onclick="loadLB()">Повторить</button></div>';}
}
// ─── PROFILE ───
function activeProfileStreak(user){
  const value=Math.max(0,Number(user?.streak)||0);
  if(!value||!user?.streak_date)return 0;
  const latest=new Date(`${user.streak_date}T00:00:00Z`);
  const now=new Date();
  const today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  return today-latest.getTime()<=86400000?value:0;
}

async function addFriend(fid){
  if(!CU){openAuth();return false;}
  const user=CU.id;
  try{
    const{data,error}=await sb.rpc('request_friendship',{p_friend_id:fid});
    if(error)throw error;
    if(CU?.id!==user)return false;
    window.FBZData?.invalidate('profile:');
    toast(data?.status==='accepted'?'Теперь вы друзья':'Заявка отправлена','ok');
    return true;
  }catch(error){if(CU?.id===user)toast('Не удалось отправить заявку','err');return false;}
}
function ensureProfileModule(){
  return Promise.all([ensureFeatureModule({key:'profile',styleId:'profileStyles',style:'css/profile.css?v=2',script:'js/profile.js?v=3',ready:()=>window.FBZProfile}),ensureExploreModule()]).then(([profile])=>profile);
}
function ensureExploreModule(){return ensureFeatureModule({key:'explore',styleId:'exploreStyles',style:'css/explore.css?v=3',script:'js/explore.js?v=2',ready:()=>window.FBZExplore});}
async function loadProfile(uid){
  const route=routeVersion,user=CU?.id;
  const target=document.getElementById('profileW');
  target.innerHTML='<div class="loading" role="status"><div class="spin"></div><span class="sr-only">Загрузка профиля</span></div>';
  try{
    const profile=await ensureProfileModule();
    if(CP==='profile'&&routeVersion===route&&CU?.id===user)return profile.mount(uid);
  }catch(error){if(CP==='profile'&&routeVersion===route)target.innerHTML='<div class="empty-state"><strong>Не удалось открыть профиль</strong><button class="btn btn-g" onclick="loadProfile(viewUID)">Повторить</button></div>';}
}
function addFriendFromProfile(fid){return window.FBZProfile?.mutateFriendship(fid,false);}
function acceptFriendFromProfile(fid){return window.FBZProfile?.mutateFriendship(fid,true);}
function invitationUrl(code){return new URL('/?invite='+encodeURIComponent(code),window.location.origin).href;}
function copyInv(c){copyText(invitationUrl(c),'Ссылка скопирована');}
async function expStats(c,a,u){
  const text=`FOOTBAZED\n@${u}\nОценок: ${c}\nСредняя: ${a}/10`;
  if(navigator.share){
    try{await navigator.share({title:'FOOTBAZED',text});return;}catch(error){if(error?.name==='AbortError')return;}
  }
  copyText(text);
}
function editProfile(){
  profileVersion++;
  const user=CU?.id,route=routeVersion,profile=profileVersion;
  ensureFeatureModule({key:'profile-editor',styleId:'profileEditorCss',style:'css/profile-editor.css?v=2',script:'js/profile-editor.js?v=1',ready:()=>window.FBZProfileEditor})
    .then(editor=>{if(CP==='profile'&&user&&CU?.id===user&&routeVersion===route&&profileVersion===profile)editor.open();}).catch(()=>{});
}

// ─── COMMUNITY LOADER ───
function ensureCommunityModule(){
  return ensureFeatureModule({key:'community',styleId:'communityCss',style:'css/community.css?v=2',script:'js/community.js?v=1',ready:()=>window.FBZCommunity});
}
function loadFriendsTab(tab){
  FT=tab;
  document.getElementById('friendsContent').innerHTML='<div class="loading"><div class="spin"></div></div>';
  return ensureCommunityModule().then(community=>{if(CP==='friends')return community.load(tab);}).catch(()=>{
    if(CP==='friends')document.getElementById('friendsContent').innerHTML='<div class="empty-state">Не удалось загрузить сообщество<button class="btn btn-g" onclick="loadFriendsTab(FT)">Повторить</button></div>';
  });
}
function searchFriends(){ensureCommunityModule().then(community=>community.search()).catch(()=>{});}
function setFTab(tab){ensureCommunityModule().then(community=>community.changeTab(tab)).catch(()=>{});}
function inviteFriend(){ensureCommunityModule().then(community=>community.invite()).catch(()=>{});}

async function handleInvite(code){
  if(!CU){openAuth();return;}
  const{data:invUser}=await sb.rpc('resolve_invite_code',{lookup_code:code}).maybeSingle();
  if(invUser&&invUser.id!==CU.id){await addFriend(invUser.id);}
}

// ─── NOTIFICATIONS LOADER ───
function ensureNotificationsModule(){return ensureFeatureModule({key:'notifications',styleId:'notificationsCss',style:'css/notifications.css?v=2',script:'js/notifications.js?v=1',ready:()=>window.FBZNotifications});}
function loadNotifications(){if(!CU)return;return ensureNotificationsModule().then(notifications=>notifications.load()).catch(()=>{});}
function toggleNotif(){ensureNotificationsModule().then(notifications=>notifications.toggle()).catch(()=>{});}
function closeNotif(returnFocus=false){window.FBZNotifications?.close(returnFocus);}
function markAllRead(){window.FBZNotifications?.markAll();}

// ─── MATCH DISCUSSION ───
async function loadChat(mid){
  if(!mid)return;
  const version=++chatVersion,user=CU?.id,route=routeVersion;
  const current=()=>version===chatVersion&&user===CU?.id&&route===routeVersion&&CP==='chat'&&String(chatMID)===String(mid);
  const body=document.getElementById('chatBody');
  body.innerHTML='<div class="loading" role="status"><div class="spin"></div><span class="sr-only">Загрузка обсуждения</span></div>';
  try{
    const{data:msgs,error}=await sb.rpc('get_match_chat_messages',{p_match_id:Number(mid),p_limit:80});
    if(!current())return;
    if(error)throw error;
    if(!msgs?.length){body.innerHTML='<div class="empty-state"><strong>Начните обсуждение</strong><p>Что запомнилось в этом матче?</p></div>';return;}
    body.innerHTML=msgs.map(m=>`<div class="cmsg ${m.user_id===CU?.id?'own':''}" data-message-id="${Number(m.id)}">
      <div class="cmsg-auth"><button type="button" onclick="go('profile',{uid:${jsStr(m.user_id)}})">@${esc(m.user?.username||'user')}</button></div>
      <div class="cmsg-text">${esc(m.message)}</div>
      <div class="cmsg-meta"><time datetime="${esc(m.created_at)}">${new Date(m.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</time>${m.edited_at?'<span>ред.</span>':''}${m.can_edit?`<button type="button" onclick="editChatMessage(${Number(m.id)})">Изменить</button>`:''}</div>
    </div>`).join('');
    body.scrollTop=body.scrollHeight;
  }catch(error){if(current())body.innerHTML='<div class="empty-state"><strong>Не удалось загрузить обсуждение</strong><button class="btn btn-g" onclick="loadChat(chatMID)">Повторить</button></div>';}
}
async function sendChat(){
  if(!CU){openAuth();return;}
  if(chatSending)return;
  const inp=document.getElementById('chatI'),button=document.getElementById('chatS');
  const msg=inp.value.trim();if(!msg)return;if(msg.length>1000){toast('Сообщение слишком длинное','err');return;}
  const user=CU.id,mid=chatMID,route=routeVersion,original=inp.value;
  const current=()=>CU?.id===user&&routeVersion===route&&CP==='chat'&&chatMID===mid;
  chatSending=true;button.disabled=true;
  try{
    const{error}=await sb.rpc('send_match_chat_message',{p_match_id:Number(mid),p_message:msg});
    if(error)throw error;
    if(!current())return;
    if(inp.value===original)inp.value='';
    await loadChat(mid);
  }catch(error){if(current())toast('Не удалось отправить сообщение. Текст сохранён.','err');}
  finally{chatSending=false;button.disabled=false;}
}
function editChatMessage(messageId){
  const message=document.querySelector(`.cmsg[data-message-id="${Number(messageId)}"]`);
  if(!message||message.querySelector('form'))return;
  const text=message.querySelector('.cmsg-text');text.hidden=true;
  const form=document.createElement('form');form.className='match-chat-editor';
  form.innerHTML=`<label class="sr-only" for="chat-edit-${Number(messageId)}">Изменить сообщение</label><textarea class="input" id="chat-edit-${Number(messageId)}" maxlength="1000" rows="3" required>${esc(text.textContent)}</textarea><div><button class="btn btn-g btn-sm" type="button">Отмена</button><button class="btn btn-l btn-sm" type="submit">Сохранить</button></div>`;
  form.querySelector('[type="button"]').onclick=()=>{text.hidden=false;form.remove();message.querySelector('.cmsg-meta button')?.focus();};
  const mid=chatMID,user=CU?.id,route=routeVersion;
  form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector('[type="submit"]');if(button.disabled)return;
    const updated=form.querySelector('textarea').value.trim();if(!updated||updated.length>1000)return;
    button.disabled=true;
    try{
      const{error}=await sb.rpc('edit_match_chat_message',{p_message_id:Number(messageId),p_message:updated});
      if(error)throw error;
      if(CU?.id===user&&routeVersion===route&&chatMID===mid)await loadChat(mid);
    }catch(error){if(form.isConnected)toast('Не удалось изменить сообщение. Текст сохранён.','err');}
    finally{button.disabled=false;}
  };
  text.after(form);form.querySelector('textarea').focus();
}

// ─── SHARE CARD ───
async function openShare(type,data){
  const route=routeVersion,user=CU?.id;
  try{
    const share=await ensureFeatureModule({key:'share',script:'js/share.js?v=1',ready:()=>window.FBZShare});
    if(route===routeVersion&&CU?.id===user)return share.open(type,data);
  }catch(error){toast('Не удалось подготовить карточку. Попробуйте ещё раз.','err');}
}
function closeShare(){window.FBZShare?.close();}
function downloadShare(){window.FBZShare?.download();}
function copyShare(){return window.FBZShare?.copy();}

function openSettings(){
  const ov=document.getElementById('settingsOv');
  if(!ov)return;
  window.FBZAppearance?.syncControls();
  const profileUrl=CU?.id?`${window.location.origin}/profile/${encodeURIComponent(CU.id)}`:'—';
  const values={
    techUserId:CU?.id||'—',
    techEmail:CU?.email||'—',
    techProfileUrl:profileUrl,
    techRole:CU?.is_admin?'Администратор':'Пользователь'
  };
  Object.entries(values).forEach(([id,value])=>{
    const el=document.getElementById(id);
    if(el)el.textContent=value;
  });
  FBZOverlay.open('settingsOv','input[name="setTheme"]:checked');
}
function closeSettings(){FBZOverlay.close('settingsOv');}
function saveAppearanceSettings(){
  const settings=window.FBZAppearance?.readControls();
  if(settings)window.FBZAppearance.save(settings);
  closeSettings();
  toast('Настройки сохранены','ok');
}
function copyTechValue(id){
  const value=document.getElementById(id)?.textContent?.trim();
  if(!value||value==='—')return;
  copyText(value);
}

// ─── REVEAL + MISC ───
function injectIcons(){
  // Nav links
  const navIcons={Главная:'home',Матчи:'football',Лента:'feed',Обзор:'chart',Друзья:'users'};
  document.querySelectorAll('.nav-link').forEach(a=>{
    const t=a.textContent.trim();if(navIcons[t])a.innerHTML=ico(navIcons[t],15)+' '+t;
  });
  // Mobile nav
  document.querySelectorAll('[data-i]').forEach(s=>{s.innerHTML=ico(s.dataset.i,s.classList.contains('mob-nav-icon')?20:16);});
  // Page titles
  const pgIcons={'Матчи':'football','Лента оценок':'feed','Голоса сообщества':'trophy','Друзья и сообщество':'users','Админ-панель':'settings'};
  document.querySelectorAll('.page-title').forEach(h=>{
    const t=h.textContent.trim();if(pgIcons[t])h.innerHTML=ico(pgIcons[t],28)+' '+t;
  });
}
function setupReveal(){
  const obs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('shown');});},{threshold:0.08});
  document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
}
let toastTimer=null;
function toast(msg,type='ok'){
  const el=document.getElementById('toast');
  if(!el)return;
  // Clear any existing timer
  if(toastTimer){clearTimeout(toastTimer);toastTimer=null;}
  // Reset state
  el.classList.remove('show');
  el.textContent=msg;
  el.className='toast '+type;
  // Show after tiny delay (force reflow)
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      el.classList.add('show');
      toastTimer=setTimeout(()=>{
        el.classList.remove('show');
        toastTimer=null;
      },3000);
    });
  });
}

// Nav scroll effect
window.addEventListener('scroll',()=>{
  const nav=document.getElementById('mainNav');
  if(nav)nav.classList.toggle('scrolled',window.scrollY>40);
});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
