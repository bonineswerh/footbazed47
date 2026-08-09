// ─── SVG ICONS (Heroicons style) ───
const I={
  home:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.955-8.955a1.126 1.126 0 0 1 1.59 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>`,
  football:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>`,
  feed:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3z"/></svg>`,
  trophy:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.996.078-1.927.228-2.25.346v2.168A2.75 2.75 0 0 0 5.25 9.5m0-5.264V4.5h13.5v-.264m0 0c.996.078 1.927.228 2.25.346v2.168A2.75 2.75 0 0 1 18.75 9.5m0-5.264V4.5"/></svg>`,
  users:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0z"/></svg>`,
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
  logout:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H5.75A1.75 1.75 0 0 0 4 7.75v8.5C4 17.216 4.784 18 5.75 18H10m4-3 3-3m0 0-3-3m3 3H9"/></svg>`,
  chevron:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m7.5 9.75 4.5 4.5 4.5-4.5"/></svg>`,
};
function ico(name,size){return(I[name]||'').replace('class="ico"',`class="ico" style="width:${size||16}px;height:${size||16}px"`);}

const DERBY=[{h:'Зенит',a:'Спартак'},{h:'Реал',a:'Барселона'},{h:'Ман Сити',a:'Ливерпуль'},{h:'Ювентус',a:'Милан'},{h:'Бавария',a:'Дортмунд'},{h:'Арсенал',a:'Тоттенхэм'}];
const LEVELS=[{n:'🌱 Новичок',m:0},{n:'🌿 Любитель',m:5},{n:'⭐ Профи',m:20},{n:'🏆 Эксперт',m:50},{n:'👑 Легенда',m:100}];
const AVCOLORS=['av-0','av-1','av-2','av-3','av-4','av-5','av-6','av-7'];
let CU=null,CP='home',PP='home';
let MF='all',ML='all',FS='all',LT='likes',FT='list';
let chatMID=null,mdID=null,viewUID=null;
let notifOpen=false;
let routeApplying=false;

function avColor(str){let h=0;for(let c of(str||'x'))h=(h<<5)-h+c.charCodeAt(0);return AVCOLORS[Math.abs(h)%8];}

async function init(){
  window.FBZAppearance?.init();
  window.FBZSearch?.init();
  try{
    const{data:{session},error}=await sb.auth.getSession();
    if(error)throw error;
    if(session)await onLogin(session.user);
    sb.auth.onAuthStateChange((event,nextSession)=>{
      if(event==='INITIAL_SESSION')return;
      setTimeout(async()=>{
        try{
          if(nextSession?.user)await onLogin(nextSession.user);
          else onLogout();
        }catch(error){
          console.warn('Auth state error:',error);
          onLogout();
        }
      },0);
    });
  }catch(e){console.warn('Auth init error:',e);}
  Promise.allSettled([loadHeroStats(),loadHomeM(),loadHomeF()]).then(results=>{
    results.filter(result=>result.status==='rejected').forEach(result=>console.warn('Initial load error:',result.reason));
  });
  setupReveal();injectIcons();
  const chatS=document.getElementById('chatS');
  const chatI=document.getElementById('chatI');
  if(chatS)chatS.onclick=sendChat;
  if(chatI)chatI.onkeypress=e=>{if(e.key==='Enter')sendChat();};
  document.addEventListener('click',e=>{if(notifOpen&&!e.target.closest('#notifPanel')&&!e.target.closest('#notifBtn'))closeNotif();});
  window.addEventListener('hashchange',applyRouteFromHash);
  const inv=new URLSearchParams(window.location.search).get('invite');
  if(inv)setTimeout(()=>handleInvite(inv),800);
  if(window.location.hash)setTimeout(applyRouteFromHash,100);
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
      <button class="notif-btn header-icon-button" id="notifBtn" type="button" onclick="toggleNotif()" aria-label="Уведомления">${ico('bell',18)}<span class="notif-badge" id="notifBadge"></span></button>
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
    if(hb)hb.innerHTML=`<button class="btn btn-l" onclick="openRegister()">Зарегистрироваться →</button>`;
  }
}

function go(p,d){
  if(p==='admin'&&!CU?.is_admin){toast('Только для администратора','err');return;}
  const page=document.getElementById(`page-${p}`);
  if(!page)return;
  PP=CP;
  document.querySelectorAll('.page').forEach(e=>e.classList.remove('on'));
  page.classList.add('on');
  document.querySelectorAll('.nav-link').forEach(l=>{l.classList.remove('active');l.removeAttribute('aria-current');});
  const lk=document.querySelector(`.nav-link[onclick*="'${p}'"]`);
  if(lk){lk.classList.add('active');lk.setAttribute('aria-current','page');}
  CP=p;window.scrollTo(0,0);closeNotif();window.FBZAccount?.close();
  // Update mobile nav
  document.querySelectorAll('.mob-nav-item').forEach(b=>{b.classList.remove('active');b.removeAttribute('aria-current');});
  const mn=document.getElementById(`mn-${p}`);if(mn){mn.classList.add('active');mn.setAttribute('aria-current','page');}
  if(!routeApplying)syncRoute(p,d);
  if(p==='matches')loadM();
  else if(p==='feed')loadFeed();
  else if(p==='leaderboard')loadLB();
  else if(p==='profile'){viewUID=d?.uid||CU?.id;loadProfile(viewUID);}
  else if(p==='md'){mdID=d?.mid;loadMD(d?.mid);}
  else if(p==='chat'){chatMID=d?.mid;document.getElementById('chatTitle').textContent=d?.title||'Чат';loadChat(d?.mid);}
  else if(p==='friends')loadFriendsTab(FT);
  else if(p==='admin')window.FBZAdmin?.mount();
}
function goBack(){go(PP);}

function syncRoute(p,d){
  const current=window.location.hash;
  let next='';
  if(p==='home')next='';
  else if(p==='profile'&&d?.uid)next=`#profile/${encodeURIComponent(d.uid)}`;
  else if(p==='profile'&&CU?.id)next=`#profile/${encodeURIComponent(CU.id)}`;
  else if(p==='md'&&d?.mid)next=`#match/${encodeURIComponent(d.mid)}`;
  else if(['matches','feed','leaderboard','friends','admin'].includes(p))next=`#${p}`;
  if(next!==current)history.pushState(null,'',next||window.location.pathname+window.location.search);
}

function applyRouteFromHash(){
  const raw=window.location.hash.replace(/^#/,'');
  if(!raw){
    if(CP!=='home'){
      routeApplying=true;
      try{go('home');}finally{routeApplying=false;}
    }
    return;
  }
  const [type,value]=raw.split('/');
  routeApplying=true;
  try{
    if(type==='profile'&&value)go('profile',{uid:decodeURIComponent(value)});
    else if(type==='match'&&value)go('md',{mid:decodeURIComponent(value)});
    else if(['matches','feed','leaderboard','friends','admin'].includes(type))go(type);
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

function copyAppLink(hash,label='Ссылка'){
  const url=`${window.location.origin}${window.location.pathname}${hash}`;
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
  const el=document.getElementById(id);if(!el)return;
  if(!t){el.textContent='0';return;}
  let c=0;const s=Math.ceil(t/40);
  const iv=setInterval(()=>{c=Math.min(c+s,t);el.textContent=c.toLocaleString('ru-RU');if(c>=t)clearInterval(iv);},25);
}

// ─── FEED ───
function renderFCard(r){
  const likes=r.rating_likes?.length||0;
  const n=r.users?.username||r.users?.display_name||'U';
  const cls=avColor(n);
  const avatar=safeImageUrl(r.users?.avatar_url);
  const av=avatar?`<img src="${avatar}" class="fc-av-img" onclick="go('profile',{uid:'${r.user_id}'})" alt="">`:`<div class="fc-av ${cls}" onclick="go('profile',{uid:'${r.user_id}'})">${esc(n[0].toUpperCase())}</div>`;
  const date=new Date(r.created_at).toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
  const stars=Array.from({length:10},(_,i)=>`<div class="fstar ${i<(r.match_rating||0)?'on':'off'}"></div>`).join('');
  return`<div class="fcard">
    <div class="fc-hd">
      ${av}
      <div><div class="fc-uname" onclick="go('profile',{uid:'${r.user_id}'})">${esc(n)}</div><div class="fc-handle">@${esc(r.users?.username||'user')}</div></div>
      <div class="fc-time">${date}</div>
    </div>
    <div class="fc-lg">${esc(r.matches?.league_name)}</div>
    <div class="fc-match" onclick="go('md',{mid:${r.match_id}})">${esc(r.matches?.home_team_name)} vs ${esc(r.matches?.away_team_name)}</div>
    <div class="fc-rating"><div class="fc-rnum">${r.match_rating||0}</div><div class="fc-rdenom">/10</div></div>
    <div class="fc-stars">${stars}</div>
    ${r.comment?`<div class="fc-cmt">${esc(r.comment)}</div>`:''}
    <div class="fc-ft">
      ${r.user_id!==CU?.id?`<button class="lbtn" onclick="tLike(${r.id},this)">${ico('heart',13)} ${likes}</button>`:`<span class="lbtn" style="opacity:0.4;cursor:default">${ico('heart',13)} ${likes}</span>`}
      <button class="cbtn" onclick="loadCmnts(${r.id},this,false,'${r.user_id}')">${ico('chat',13)} Комментарии</button>
    </div>
    <div id="fc-${r.id}"></div>
  </div>`;
}
async function loadHomeF(){
  try{
    const{data}=await sb.from('ratings').select(RATING_FIELDS).eq('is_public',true).order('created_at',{ascending:false}).limit(6);
    if(!data?.length){document.getElementById('homeF').innerHTML=`<div class="empty-state"><div class="empty-icon">⚽</div>Оценки появятся здесь</div>`;return;}
    const enriched=await enrichRatings(data);
    document.getElementById('homeF').innerHTML=enriched.map(renderFCard).join('');
  }catch(e){document.getElementById('homeF').innerHTML=`<div class="empty-state"><div class="empty-icon">⚽</div>Оценки появятся здесь</div>`;}
}
async function loadFeed(){
  document.getElementById('feedG').innerHTML='<div class="loading"><div class="spin"></div></div>';
  try{
    let uids=null;
    if(FS==='friends'){
      if(!CU){document.getElementById('feedG').innerHTML='<div class="empty-state">Войди чтобы видеть оценки друзей</div>';return;}
      const{data:fs}=await sb.from('friendships').select('friend_id').eq('user_id',CU.id).eq('status','accepted');
      uids=fs?.map(f=>f.friend_id)||[];
      if(!uids.length){document.getElementById('feedG').innerHTML='<div class="empty-state"><div class="empty-icon">👥</div>Добавь друзей чтобы видеть их оценки</div>';return;}
    }
    let q=sb.from('ratings').select(RATING_FIELDS).eq('is_public',true);
    if(uids)q=q.in('user_id',uids);
    const{data:rt}=await q.order('created_at',{ascending:false}).limit(50);
    if(!rt?.length){document.getElementById('feedG').innerHTML=`<div class="empty-state"><div class="empty-icon">⚽</div>Пока нет оценок<br><button class="btn btn-l btn-sm" style="margin-top:16px" onclick="go('matches')">Перейти к матчам →</button></div>`;return;}
    const enriched=await enrichRatings(rt);
    let res=enriched;
    if(FS==='popular')res.sort((a,b)=>(b._likes||0)-(a._likes||0));
    document.getElementById('feedG').innerHTML=res.map(renderFCard).join('');
  }catch(e){
    document.getElementById('feedG').innerHTML=`<div class="empty-state"><div class="empty-icon">⚠️</div>Ошибка загрузки ленты</div>`;
  }
}
async function enrichRatings(ratings){
  if(!ratings?.length)return[];
  const userIds=[...new Set(ratings.map(r=>r.user_id))];
  const matchIds=[...new Set(ratings.map(r=>r.match_id))];
  const ratingIds=ratings.map(r=>r.id);
  const[{data:users},{data:matches},{data:likes}]=await Promise.all([
    sb.from('users').select('id,display_name,username,avatar_url').in('id',userIds),
    sb.from('matches').select('id,home_team_name,away_team_name,league_name').in('id',matchIds),
    sb.from('rating_likes').select('rating_id').in('rating_id',ratingIds)
  ]);
  const uMap={};(users||[]).forEach(u=>uMap[u.id]=u);
  const mMap={};(matches||[]).forEach(m=>mMap[m.id]=m);
  const lMap={};(likes||[]).forEach(l=>lMap[l.rating_id]=(lMap[l.rating_id]||0)+1);
  return ratings.map(r=>({...r,users:uMap[r.user_id]||{display_name:'Аноним',username:'user'},matches:mMap[r.match_id]||{home_team_name:'?',away_team_name:'?',league_name:''},_likes:lMap[r.id]||0,rating_likes:Array(lMap[r.id]||0).fill({id:0})}));
}
function setFS(s,btn){FS=s;document.querySelectorAll('#feedT .btn').forEach(b=>b.className='btn btn-g btn-sm');btn.className='btn btn-l btn-sm';loadFeed();}

async function tLike(id,btn){
  if(!CU){openAuth();return;}
  const{data:ex}=await sb.from('rating_likes').select('id').eq('user_id',CU.id).eq('rating_id',id).maybeSingle();
  if(ex){
    const{error}=await sb.from('rating_likes').delete().eq('id',ex.id);
    if(error){console.error('Unlike error:',error);return;}
    btn.classList.remove('on');btn.innerHTML=btn.innerHTML.replace(/\d+/,n=>Math.max(0,parseInt(n)-1));
  }else{
    const{error}=await sb.from('rating_likes').insert({user_id:CU.id,rating_id:id});
    if(error){console.error('Like error:',error);toast('Ошибка','err');return;}
    btn.classList.add('on');btn.innerHTML=btn.innerHTML.replace(/\d+/,n=>parseInt(n)+1);
  }
}
async function loadCmnts(rid,btn,force,ownerId){
  const w=document.getElementById(`fc-${rid}`);
  if(!force&&w.innerHTML){w.innerHTML='';return;}
  const{data:cs}=await sb.from('rating_comments').select('id,rating_id,user_id,comment,created_at').eq('rating_id',rid).order('created_at',{ascending:true});
  const uids=[...new Set((cs||[]).map(c=>c.user_id))];
  let uMap={};
  if(uids.length){const{data:us}=await sb.from('users').select('id,display_name,username,avatar_url').in('id',uids);(us||[]).forEach(u=>uMap[u.id]=u);}
  const isOwn=ownerId&&CU?.id===ownerId;
  w.innerHTML=`<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--b1)">
    ${(cs||[]).map(c=>{const u=uMap[c.user_id];return`<div style="padding:8px 10px;background:var(--bg3);border-radius:8px;margin-bottom:5px"><div style="font-size:10px;font-weight:700;color:var(--accent2);margin-bottom:2px">@${esc(u?.username||'user')}</div><div style="font-size:13px;color:var(--text2)">${esc(c.comment)}</div></div>`;}).join('')}
    ${!isOwn&&CU?`<div style="display:flex;gap:7px;margin-top:8px">
      <input id="ci-${rid}" maxlength="1000" style="flex:1;padding:8px 12px;background:var(--bg3);border:1px solid var(--b1);border-radius:8px;color:var(--snow);font-size:12px;font-family:inherit" placeholder="Комментарий...">
      <button onclick="addCmnt(${rid})" class="btn btn-l btn-sm">→</button>
    </div>`:''}
  </div>`;
}
async function addCmnt(rid){
  if(!CU){openAuth();return;}
  const inp=document.getElementById(`ci-${rid}`);
  const t=inp?.value?.trim();if(!t)return;if(t.length>1000){toast('Комментарий слишком длинный','err');return;}
  const{error}=await sb.from('rating_comments').insert({rating_id:rid,user_id:CU.id,comment:t});
  if(error){toast('Ошибка','err');console.error(error);return;}
  inp.value='';loadCmnts(rid,null,true);
}

// ─── LEADERBOARD ───
let lbU=[];
async function loadLB(){
  document.getElementById('lbT').innerHTML='<div class="loading"><div class="spin"></div></div>';
  document.getElementById('lbPod').innerHTML='';
  const{data:users}=await sb.from('users').select(PUBLIC_USER_FIELDS).limit(30);
  if(!users?.length){document.getElementById('lbT').innerHTML='<div class="empty-state">Нет данных</div>';return;}
  const ids=users.map(u=>u.id);
  const{data:allR}=await sb.from('ratings').select('id,user_id').in('user_id',ids);
  const rIds=(allR||[]).map(r=>r.id);
  let lm={};
  if(rIds.length){const{data:lk}=await sb.from('rating_likes').select('rating_id').in('rating_id',rIds);(lk||[]).forEach(l=>{const r=allR.find(x=>x.id===l.rating_id);if(r)lm[r.user_id]=(lm[r.user_id]||0)+1;});}
  const rcm={};(allR||[]).forEach(r=>{rcm[r.user_id]=(rcm[r.user_id]||0)+1;});
  lbU=users.map(u=>({...u,tl:lm[u.id]||0,rc:rcm[u.id]||u.ratings_count||0}));
  renderLB();
}
function renderLB(){
  const sorted=[...lbU].sort((a,b)=>LT==='likes'?b.tl-a.tl:b.rc-a.rc);
  const top3=sorted.slice(0,3);
  const ord=top3.length>=3?[top3[1],top3[0],top3[2]]:top3;
  const pc=top3.length>=3?['p2','p1','p3']:['p1','p2','p3'];
  document.getElementById('lbPod').innerHTML=ord.map((u,i)=>{
    if(!u)return'';
    const val=LT==='likes'?u.tl:u.rc;const lbl=LT==='likes'?'лайков':'оценок';
    const cls=avColor(u.username||'x');
    const avatar=safeImageUrl(u.avatar_url);
    const av=avatar?`<img src="${avatar}" style="width:52px;height:52px;border-radius:13px;object-fit:cover" alt="">`:`<div class="lb-av ${cls}">${esc((u.username?.[0]||'U').toUpperCase())}</div>`;
    return`<div class="lb-pod ${pc[i]}" onclick="go('profile',{uid:'${u.id}'})">
      <div class="lb-crown">${i===1&&top3.length>=3?'👑':'⠀'}</div>
      ${av}
      <div class="lb-pname">${esc(u.username||'Аноним')}</div>
      <div class="lb-phand">@${esc(u.username||'user')}</div>
      <div class="lb-pval">${val}</div>
      <div class="lb-plbl">${lbl}</div>
    </div>`;
  }).join('');
  document.getElementById('lbT').innerHTML=sorted.slice(3).map((u,i)=>{
    const val=LT==='likes'?u.tl:u.rc;const lbl=LT==='likes'?'лайков':'оценок';
    const cls=avColor(u.username||'x');
    const avatar=safeImageUrl(u.avatar_url);
    const av=avatar?`<img src="${avatar}" style="width:34px;height:34px;border-radius:9px;object-fit:cover" alt="">`:`<div class="lb-uav ${cls}">${esc((u.username?.[0]||'U').toUpperCase())}</div>`;
    return`<div class="lb-row" onclick="go('profile',{uid:'${u.id}'})">
      <div class="lb-rank">${i+4}</div>
      <div class="lb-user">${av}<div><div class="lb-uname">${esc(u.username||'Аноним')}</div><div class="lb-uhand">@${esc(u.username||'user')}</div></div></div>
      <div class="lb-score"><div class="lb-sval">${val}</div><div class="lb-slbl">${lbl}</div></div>
    </div>`;
  }).join('');
}
function setLT(t,btn){LT=t;document.querySelectorAll('.lb-tab').forEach(b=>{b.className='btn btn-g btn-sm lb-tab';});btn.className='btn btn-l btn-sm lb-tab';renderLB();}

// ─── PROFILE ───
function renderProfileInsights(ratings,matchMap){
  const list=ratings||[];
  if(!list.length)return`<div class="pcard"><div class="pcard-title">${ico('sparkle',14)} Футбольный почерк</div><div class="empty-state" style="padding:18px 0">Появится после первых оценок</div></div>`;
  const nums=list.map(r=>Number(r.match_rating)||0).filter(Boolean);
  const avg=nums.length?nums.reduce((s,n)=>s+n,0)/nums.length:0;
  const style=avg>=8.2?{t:'Щедрый эксперт',d:'чаще видит сильные стороны матча'}:avg<=5.8?{t:'Строгий критик',d:'требовательно относится к качеству игры'}:{t:'Сбалансированный судья',d:'оценивает без крайностей'};
  const publicCount=list.filter(r=>r.is_public).length;
  const publicPct=Math.round(publicCount/list.length*100);
  const leagueMap={};
  list.forEach(r=>{const lg=matchMap[r.match_id]?.league_name||'Другое';leagueMap[lg]=(leagueMap[lg]||0)+1;});
  const leagues=Object.entries(leagueMap).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const high=nums.filter(n=>n>=8).length;
  const low=nums.filter(n=>n<=5).length;
  const best=list.reduce((acc,r)=>!acc||Number(r.match_rating)>Number(acc.match_rating)?r:acc,null);
  const bestMatch=best&&matchMap[best.match_id];
  return`<div class="pcard"><div class="pcard-title">${ico('sparkle',14)} Футбольный почерк</div>
    <div class="p-insight-main">
      <div><div class="p-insight-k">Стиль</div><div class="p-insight-v">${style.t}</div><div class="p-insight-d">${style.d}</div></div>
      <div><div class="p-insight-k">Публичность</div><div class="p-insight-v">${publicPct}%</div><div class="p-insight-d">оценок открыты для ленты</div></div>
    </div>
    <div class="p-insight-grid">
      <div class="p-mini"><span>${high}</span><small>высоких оценок</small></div>
      <div class="p-mini"><span>${low}</span><small>строгих оценок</small></div>
      <div class="p-mini"><span>${leagues[0]?.[1]||0}</span><small>${esc(leagues[0]?.[0]||'любимая лига')}</small></div>
    </div>
    ${leagues.length?`<div class="p-leagues">${leagues.map(([lg,c])=>`<div class="p-league"><span>${esc(lg)}</span><b>${c}</b></div>`).join('')}</div>`:''}
    ${bestMatch?`<div class="p-best-match">Самая высокая оценка: <b>${best.match_rating}/10</b> · ${esc(bestMatch.home_team_name)} vs ${esc(bestMatch.away_team_name)}</div>`:''}
  </div>`;
}
function renderRatingDistribution(ratings){
  const list=(ratings||[]).filter(r=>Number(r.match_rating)>0);
  if(!list.length)return`<div class="pcard"><div class="pcard-title">${ico('chart',14)} Распределение оценок</div><div class="empty-state" style="padding:18px 0">Нет данных</div></div>`;
  const total=list.length;
  const counts=Array.from({length:10},(_,i)=>10-i).map(n=>({n,c:list.filter(r=>Number(r.match_rating)===n).length}));
  const max=Math.max(...counts.map(x=>x.c),1);
  return`<div class="pcard"><div class="pcard-title">${ico('chart',14)} Распределение оценок</div>
    <div class="prdist">${counts.map(x=>`
      <div class="prdist-row">
        <span>${x.n}</span>
        <div class="prdist-bar"><i style="width:${Math.max((x.c/max)*100, x.c?8:0)}%"></i></div>
        <b>${x.c}</b>
      </div>`).join('')}
    </div>
    <div class="prdist-note">${total} последних оценок в профиле</div>
  </div>`;
}
function renderFootballPassport(u,ratings,matchMap,cnt,avg,likes,friends,level,avatar,cls){
  const leagueMap={};
  (ratings||[]).forEach(r=>{const lg=matchMap[r.match_id]?.league_name||'Другое';leagueMap[lg]=(leagueMap[lg]||0)+1;});
  const topLeague=Object.entries(leagueMap).sort((a,b)=>b[1]-a[1])[0]?.[0]||'Пока без лиги';
  const fbzScore=Math.min(99,Math.round((cnt||0)*1.4+(likes||0)*1.8+(friends?.length||0)*1.2+(u.streak||0)*3));
  const role=cnt>=50?'Легенда трибун':cnt>=20?'Эксперт матча':cnt>=5?'Активный болельщик':'Новый голос';
  const av=avatar?`<img src="${avatar}" class="fpass-av-img" alt="">`:`<div class="fpass-av ${cls}">${esc((u.username?.[0]||'U').toUpperCase())}</div>`;
  return`<div class="fpass">
    <div class="fpass-bg"></div>
    <div class="fpass-top"><span>FOOTBAZED CARD</span><b>${fbzScore}</b></div>
    <div class="fpass-main">
      ${av}
      <div>
        <div class="fpass-name">${esc(u.username||'Аноним')}</div>
        <div class="fpass-role">${role}</div>
      </div>
    </div>
    <div class="fpass-strip">
      <div><span>${cnt||0}</span><small>Оценки</small></div>
      <div><span>${avg}</span><small>Средняя</small></div>
      <div><span>${likes||0}</span><small>Лайки</small></div>
    </div>
    <div class="fpass-meta">
      <div><small>Уровень</small><b>${level.n}</b></div>
      <div><small>Главная лига</small><b>${esc(topLeague)}</b></div>
    </div>
  </div>`;
}
async function loadProfile(uid){
  const w=document.getElementById('profileW');
  if(!uid){w.innerHTML='<div class="empty-state"><div class="empty-icon">👤</div>Войдите чтобы увидеть профиль</div>';return;}
  w.innerHTML='<div class="loading"><div class="spin"></div></div>';
  try{
    const ownsProfile=CU?.id===uid;
    let u,error;
    if(ownsProfile){
      ({data:u,error}=await sb.rpc('get_my_profile').maybeSingle());
      if(u){u={...u,email:CU?.email};CU={...CU,...u};}
    }else{
      ({data:u,error}=await sb.from('users').select(PUBLIC_USER_FIELDS).eq('id',uid).maybeSingle());
    }
    if(error)throw error;
    if(!u){w.innerHTML='<div class="empty-state"><div class="empty-icon">👤</div>Профиль не найден<br><span style="font-size:13px;color:var(--fog);margin-top:8px;display:block">Попробуйте войти заново</span></div>';return;}
    const{data:ratings}=await sb.from('ratings').select(RATING_FIELDS).eq('user_id',uid).order('created_at',{ascending:false}).limit(50);
    let fs=[];
    try{const{data:f1}=await sb.from('friendships').select('id').eq('user_id',uid).eq('status','accepted');const{data:f2}=await sb.from('friendships').select('id').eq('friend_id',uid).eq('status','accepted');fs=[...(f1||[]),...(f2||[])];}catch(e){}
    // Get likes count
    const rIds=(ratings||[]).map(r=>r.id);
    let tl=0;
    if(rIds.length){const{data:lk}=await sb.from('rating_likes').select('id').in('rating_id',rIds);tl=lk?.length||0;}
    // Get match info for ratings
    const matchIds=[...new Set((ratings||[]).map(r=>r.match_id))];
    let matchMap={};
    if(matchIds.length){const{data:ms}=await sb.from('matches').select('id,home_team_name,away_team_name,league_name').in('id',matchIds);(ms||[]).forEach(m=>matchMap[m.id]=m);}
    const profileInsights=renderProfileInsights(ratings,matchMap);
    const ratingDistribution=renderRatingDistribution(ratings);

    const cnt=u.ratings_count||0;
    const lv=LEVELS.slice().reverse().find(l=>cnt>=l.m)||LEVELS[0];
    const nx=LEVELS[LEVELS.indexOf(lv)+1];
    const pct=nx?Math.min(((cnt-lv.m)/(nx.m-lv.m))*100,100):100;
    const avg=ratings?.length?(ratings.reduce((s,r)=>s+(r.match_rating||0),0)/ratings.length).toFixed(1):'—';
    const isMe=ownsProfile;
    const j=new Date(u.created_at||Date.now());
    const ms2=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    const cls=avColor(u.username||'x');
        const avatar=safeImageUrl(u.avatar_url);
        const avatarHtml=avatar?`<img src="${avatar}" class="phero-av-img" alt="">`:`<div class="phero-av ${cls}">${esc((u.username?.[0]||'U').toUpperCase())}</div>`;
    const footballPassport=renderFootballPassport(u,ratings,matchMap,cnt,avg,tl,fs,lv,avatar,cls);

    // Check friendship status for non-self profiles
    let friendBtn='';
    if(!isMe&&CU){
      const{data:fr}=await sb.from('friendships').select('status').eq('user_id',CU.id).eq('friend_id',uid).maybeSingle();
      if(fr?.status==='accepted')friendBtn=`<button class="btn btn-g btn-sm" disabled style="opacity:0.6;cursor:default">${ico('users',13)} В друзьях</button>`;
      else if(fr?.status==='pending')friendBtn=`<button class="btn btn-g btn-sm" disabled style="opacity:0.6;cursor:default">⏳ Заявка отправлена</button>`;
      else friendBtn=`<button class="btn btn-l btn-sm" id="profAddBtn" onclick="addFriendFromProfile('${uid}')">${ico('users',13)} Добавить в друзья</button>`;
    }else if(!isMe){
      friendBtn=`<button class="btn btn-l btn-sm" onclick="openAuth()">Войти чтобы добавить</button>`;
    }
    const ownerActions=isMe?`<button class="btn btn-g btn-sm" onclick="editProfile()">${ico('edit',13)} Редактировать</button>`:friendBtn;

    w.innerHTML=`
    <div class="phero">
      ${avatarHtml}
      <div class="phero-name">${esc(u.username||'Аноним')}</div>
      ${u.bio?`<div class="phero-bio">${esc(u.bio)}</div>`:''}
      ${u.favorite_teams?`<div style="font-size:12px;color:var(--accent2);margin-bottom:12px">❤️ ${esc(u.favorite_teams)}</div>`:''}
      <div class="phero-badges">
        <span class="pbadge pb-l">${lv.n}</span>
        ${u.streak>0?`<span class="pbadge pb-s">🔥 ${u.streak} дней подряд</span>`:''}
        <span class="pbadge pb-j">С ${j.getDate()} ${ms2[j.getMonth()]} ${j.getFullYear()}</span>
      </div>
      <div class="lp" style="width:100%;max-width:400px">
        <div class="lp-t"><span class="lp-c">${lv.n}</span>${nx?`<span class="lp-n">${nx.n} при ${nx.m} оценках</span>`:''}</div>
        <div class="lp-bar"><div class="lp-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="pstats">
        <div class="pst"><div class="pst-v">${cnt}</div><div class="pst-l">Оценок</div></div>
        <div class="pst"><div class="pst-v">${avg}</div><div class="pst-l">Средняя</div></div>
        <div class="pst"><div class="pst-v">${tl}</div><div class="pst-l">Лайков</div></div>
        <div class="pst"><div class="pst-v">${fs?.length||0}</div><div class="pst-l">Друзей</div></div>
      </div>
      <div class="phero-acts">
        ${ownerActions}
        <button class="btn btn-g btn-sm" onclick="copyAppLink('#profile/${uid}','Ссылка на профиль')">${ico('link',13)} Ссылка</button>
      </div>
    </div>
    <div class="pgrid">
      <div>
        ${profileInsights}
        <div class="pcard"><div class="pcard-title">${ico('chart',14)} История оценок</div>${ratings?.length?ratings.slice(0,20).map(r=>{const mt=matchMap[r.match_id];return`<div class="rh-row" ${mt?`onclick="go('md',{mid:${r.match_id}})" style="cursor:pointer"`:''}><div><div class="rh-m">${mt?esc(mt.home_team_name)+' vs '+esc(mt.away_team_name):'Матч #'+r.match_id}</div><div class="rh-l">${esc(mt?.league_name)} · ${new Date(r.created_at).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}${r.is_public?'':' · приватно'}</div></div><div class="rh-r"><div class="rh-bar"><div class="rh-fill" style="width:${(r.match_rating||0)*10}%"></div></div><div class="rh-v">${r.match_rating}/10</div></div></div>`;}).join(''):'<div class="empty-state" style="padding:20px 0">Нет оценок</div>'}</div>
      </div>
      <div>
        ${footballPassport}
        ${ratingDistribution}
        ${isMe&&u.invite_code?`<div class="pcard"><div class="pcard-title">${ico('link',14)} Пригласи друга</div><div style="background:var(--bg3);border:1px solid var(--b1);border-radius:9px;padding:12px;margin-bottom:12px;word-break:break-all;font-size:11px;color:var(--accent2)">https://footbazed47.vercel.app/?invite=${u.invite_code}</div><button class="btn btn-l" style="width:100%" onclick="copyInv('${u.invite_code}')">${ico('copy',13)} Копировать ссылку</button></div>`:''}
        <div class="pcard"><div class="pcard-title">${ico('share',14)} Поделиться</div>
          <button class="btn btn-l" style="width:100%;margin-bottom:8px" onclick="openShare('profile',{name:${jsStr(u.display_name||'')},username:${jsStr(u.username||'user')},ratings:${cnt},avg:${jsStr(avg)},likes:${tl},friends:${fs?.length||0},level:${jsStr(lv.n)}})">${ico('photo',13)} Создать карточку</button>
          <button class="btn btn-g" style="width:100%" onclick="expStats(${cnt},${jsStr(avg)},${jsStr(u.username||'user')})">${ico('copy',13)} Копировать текст</button>
        </div>
      </div>
    </div>`;
  }catch(e){
    console.error('Profile error:',e);
    w.innerHTML=`<div class="empty-state"><div class="empty-icon">⚠️</div>Ошибка загрузки профиля</div>`;
  }
}
async function addFriend(fid){
  if(!CU){openAuth();return;}
  const{data:ex}=await sb.from('friendships').select('id,status').eq('user_id',CU.id).eq('friend_id',fid).maybeSingle();
  if(ex){toast(ex.status==='pending'?'⏳ Заявка уже отправлена':'✓ Уже в друзьях','err');return;}
  await sb.from('friendships').insert({user_id:CU.id,friend_id:fid,status:'pending'});
  try{await sb.from('notifications').insert({user_id:fid,from_user_id:CU.id,type:'friend_request',message:`${CU.username||'Кто-то'} хочет дружить`});}catch(e){}
  toast('Заявка отправлена!','ok');
}
async function addFriendFromProfile(fid){
  await addFriend(fid);
  const btn=document.getElementById('profAddBtn');
  if(btn){btn.disabled=true;btn.style.opacity='0.6';btn.style.cursor='default';btn.innerHTML='⏳ Заявка отправлена';btn.onclick=null;}
}
function copyInv(c){copyText(`${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(c)}`,'Ссылка скопирована');}
async function expStats(c,a,u){
  const text=`FOOTBAZED\n@${u}\nОценок: ${c}\nСредняя: ${a}/10`;
  if(navigator.share){
    try{await navigator.share({title:'FOOTBAZED',text});return;}catch(error){if(error?.name==='AbortError')return;}
  }
  copyText(text);
}
function editProfile(){
  const w=document.getElementById('profileW');
  const cls=avColor(CU.username||'x');
  const avatar=safeImageUrl(CU.avatar_url);
  const avatarHtml=avatar?`<img src="${avatar}" class="phero-av-img" id="avPreview" alt="">`:`<div class="phero-av ${cls}" id="avPreview">${esc((CU.username?.[0]||'U').toUpperCase())}</div>`;
  w.innerHTML=`
  <div class="phero" style="max-width:500px;margin:0 auto">
    <div style="position:relative;cursor:pointer" onclick="document.getElementById('avFile').click()">
      ${avatarHtml}
      <div class="av-overlay">${ico('photo',20)}</div>
    </div>
    <input type="file" id="avFile" accept="image/*" style="display:none" onchange="previewAvatar(this)">
    <h2 style="font-family:'Bebas Neue',sans-serif;font-size:24px;margin:16px 0 20px">${ico('edit',20)} Редактирование профиля</h2>
    <div style="width:100%;max-width:380px">
      <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px;text-align:left">Никнейм</label>
      <input class="input" id="ep_user" value="${esc(CU.username)}" placeholder="Твой никнейм">
      <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px;text-align:left">Email</label>
      <input class="input" id="ep_email" value="${esc(CU.email)}" disabled style="opacity:0.5;cursor:not-allowed">
      <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px;text-align:left">О себе</label>
      <input class="input" id="ep_bio" value="${esc(CU.bio)}" placeholder="Расскажи о себе" maxlength="120">
      <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px;text-align:left">Любимые команды</label>
      <input class="input" id="ep_teams" value="${esc(CU.favorite_teams)}" placeholder="Барселона, Ман Сити...">
      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="btn btn-g" style="flex:1" onclick="loadProfile(CU.id)">Отмена</button>
        <button class="btn btn-l" style="flex:1" id="epSaveBtn" onclick="saveEditProfile()">Сохранить</button>
      </div>
    </div>
  </div>`;
}
let pendingAvatar=null;
function previewAvatar(input){
  if(!input.files||!input.files[0])return;
  const file=input.files[0];
  if(file.size>5*1024*1024){toast('Максимум 5MB','err');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    // Resize to 200x200
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas');
      const size=200;c.width=size;c.height=size;
      const ctx=c.getContext('2d');
      const s=Math.min(img.width,img.height);
      const sx=(img.width-s)/2,sy=(img.height-s)/2;
      ctx.drawImage(img,sx,sy,s,s,0,0,size,size);
      pendingAvatar=c.toDataURL('image/jpeg',0.8);
      const preview=document.getElementById('avPreview');
      if(preview.tagName==='IMG'){preview.src=pendingAvatar;}
      else{preview.outerHTML=`<img src="${pendingAvatar}" class="phero-av-img" id="avPreview">`;}
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}
async function saveEditProfile(){
  const user=document.getElementById('ep_user').value.trim();
  const bio=document.getElementById('ep_bio').value.trim();
  const teams=document.getElementById('ep_teams').value.trim();
  if(!user||user.length<3){toast('Никнейм: минимум 3 символа','err');return;}
  if(!/^[a-zA-Z0-9_а-яёА-ЯЁ]{3,30}$/.test(user)){toast('Без пробелов и спецсимволов','err');return;}
  // Check if username changed and is taken
  if(user!==CU.username){
    const{data:exU}=await sb.from('users').select('id').eq('username',user).maybeSingle();
    if(exU){toast('Никнейм занят','err');return;}
  }
  const btn=document.getElementById('epSaveBtn');
  btn.disabled=true;btn.textContent='Сохраняем...';
  const upd={username:user,display_name:user,bio:bio||null,favorite_teams:teams||null};
  if(pendingAvatar)upd.avatar_url=pendingAvatar;
  const{error}=await sb.from('users').update(upd).eq('id',CU.id);
  if(error){toast('Ошибка: '+error.message,'err');btn.disabled=false;btn.textContent='Сохранить';return;}
  CU.username=user;CU.display_name=user;CU.bio=bio;CU.favorite_teams=teams;
  if(pendingAvatar){CU.avatar_url=pendingAvatar;pendingAvatar=null;}
  // Clear cached data so feeds reflect updated profile
  clearAppCache();
  renderNav();loadProfile(CU.id);toast('Профиль обновлён!','ok');
}

// ─── FRIENDS PAGE ───
function friendAvatar(u,size=40){
  const cls=avColor(u?.display_name||u?.username||'x');
  const avatar=safeImageUrl(u?.avatar_url);
  const initial=esc((u?.username?.[0]||'U').toUpperCase());
  if(avatar)return`<img src="${avatar}" style="width:${size}px;height:${size}px;border-radius:${Math.max(8,Math.round(size/4))}px;object-fit:cover;flex-shrink:0" alt="">`;
  return`<div class="fcard-av ${cls}" style="width:${size}px;height:${size}px;font-size:${Math.max(14,Math.round(size*0.45))}px">${initial}</div>`;
}
async function loadFriendsTab(tab){
  FT=tab;
  const el=document.getElementById('friendsContent');
  el.innerHTML='<div class="loading"><div class="spin"></div></div>';
  if(!CU){el.innerHTML='<div class="friends-empty">Войди чтобы видеть друзей</div>';return;}
  try{
    if(tab==='list'){
      const{data:fs}=await sb.from('friendships').select('friend_id').eq('user_id',CU.id).eq('status','accepted');
      if(!fs?.length){el.innerHTML='<div class="friends-empty"><div class="empty-icon">👥</div>У тебя пока нет друзей<br><small style="font-size:13px">Найди их через поиск или поделись ссылкой</small></div>';return;}
      const fids=fs.map(f=>f.friend_id);
      const{data:users}=await sb.from('users').select(PUBLIC_USER_FIELDS).in('id',fids);
      el.innerHTML=(users||[]).map(u=>{
        return`<div class="friend-card" onclick="go('profile',{uid:'${u.id}'})">${friendAvatar(u)}<div class="fcard-info"><div class="fcard-name">${esc(u.username||'Аноним')}</div><div class="fcard-sub">@${esc(u.username||'user')} · ${esc(u.ratings_count||0)} оценок</div></div><div class="fcard-action"><button class="fbtn remove" onclick="event.stopPropagation();removeFriend('${u.id}',this)">✕</button></div></div>`;
      }).join('')||'<div class="friends-empty">Нет друзей</div>';
    } else if(tab==='incoming'){
      const{data:inc}=await sb.from('friendships').select('user_id').eq('friend_id',CU.id).eq('status','pending');
      if(!inc?.length){el.innerHTML='<div class="friends-empty"><div class="empty-icon">📭</div>Нет входящих заявок</div>';return;}
      const uids=inc.map(f=>f.user_id);
      const{data:users}=await sb.from('users').select(PUBLIC_USER_FIELDS).in('id',uids);
      el.innerHTML=(users||[]).map(u=>{
        return`<div class="friend-card">${friendAvatar(u)}<div class="fcard-info"><div class="fcard-name">${esc(u.username||'Аноним')}</div><div class="fcard-sub">@${esc(u.username||'user')}</div></div><div class="fcard-action"><button class="fbtn accept" onclick="acceptFriend('${u.id}',this.parentElement.parentElement)">✓ Принять</button><button class="fbtn reject" onclick="rejectFriend('${u.id}',this.parentElement.parentElement)">✕</button></div></div>`;
      }).join('');
    } else if(tab==='outgoing'){
      const{data:out}=await sb.from('friendships').select('friend_id').eq('user_id',CU.id).eq('status','pending');
      if(!out?.length){el.innerHTML='<div class="friends-empty"><div class="empty-icon">📤</div>Нет исходящих заявок</div>';return;}
      const fids=out.map(f=>f.friend_id);
      const{data:users}=await sb.from('users').select(PUBLIC_USER_FIELDS).in('id',fids);
      el.innerHTML=(users||[]).map(u=>{
        return`<div class="friend-card">${friendAvatar(u)}<div class="fcard-info"><div class="fcard-name">${esc(u.username||'Аноним')}</div><div class="fcard-sub">@${esc(u.username||'user')} · Ожидает ответа</div></div><div class="fcard-action"><button class="fbtn reject" onclick="cancelFriend('${u.id}',this.parentElement.parentElement)">Отменить</button></div></div>`;
      }).join('');
    } else if(tab==='suggest'){
      const{data:top}=await sb.from('users').select(PUBLIC_USER_FIELDS).neq('id',CU.id).order('ratings_count',{ascending:false}).limit(12);
      if(!top?.length){el.innerHTML='<div class="friends-empty">Нет рекомендаций</div>';return;}
      const{data:myFs}=await sb.from('friendships').select('friend_id').eq('user_id',CU.id);
      const myFIds=(myFs||[]).map(f=>f.friend_id);
      const filtered=top.filter(u=>!myFIds.includes(u.id));
      el.innerHTML=filtered.slice(0,8).map(u=>{
        return`<div class="friend-card" onclick="go('profile',{uid:'${u.id}'})">${friendAvatar(u)}<div class="fcard-info"><div class="fcard-name">${esc(u.username||'Аноним')}</div><div class="fcard-sub">@${esc(u.username||'user')} · ${esc(u.ratings_count||0)} оценок</div></div><div class="fcard-action"><button class="fbtn add" onclick="event.stopPropagation();addFriendQ('${u.id}',this)">+ Добавить</button></div></div>`;
      }).join('');
    }
  }catch(e){
    console.error('Friends error:',e);
    el.innerHTML='<div class="friends-empty"><div class="empty-icon">⚠️</div>Ошибка загрузки</div>';
  }
}
function setFTab(tab,btn){document.querySelectorAll('.ftab2').forEach(b=>{b.className='btn btn-g btn-sm ftab2';});btn.className='btn btn-l btn-sm ftab2';loadFriendsTab(tab);}
async function searchFriends(){
  const q=document.getElementById('friendSearch').value.trim();
  const el=document.getElementById('friendSearchRes');
  if(q.length<2){el.innerHTML='';return;}
  const{data:users}=await sb.from('users').select(PUBLIC_USER_FIELDS).ilike('username','%'+q+'%').limit(8);
  if(!users?.length){el.innerHTML='<div style="padding:16px;color:var(--fog);font-size:13px;text-align:center">Не найдено</div>';return;}
  el.innerHTML=users.map(u=>{
    const isSelf=CU&&u.id===CU.id;
    return`<div class="friend-card" onclick="go('profile',{uid:'${u.id}'})">${friendAvatar(u,36)}<div class="fcard-info"><div class="fcard-name">${esc(u.username||'Аноним')}</div><div class="fcard-sub">@${esc(u.username||'user')}</div></div>${!isSelf?`<button class="fbtn add btn-sm" onclick="event.stopPropagation();addFriendQ('${u.id}',this)">+</button>`:''}</div>`;
  }).join('');
}
async function addFriendQ(fid,btn){await addFriend(fid);btn.textContent='✓';btn.classList.remove('add');btn.disabled=true;}
async function acceptFriend(fid,card){
  await sb.from('friendships').update({status:'accepted'}).eq('user_id',fid).eq('friend_id',CU.id);
  await sb.from('friendships').insert({user_id:CU.id,friend_id:fid,status:'accepted'});
  // Mark friend_request notification as read
  await sb.from('notifications').update({read:true}).eq('user_id',CU.id).eq('from_user_id',fid).eq('type','friend_request');
  card.remove();toast('✅ Заявка принята!','ok');
  loadNotifications();
}
async function rejectFriend(fid,card){await sb.from('friendships').delete().eq('user_id',fid).eq('friend_id',CU.id);card.remove();}
function removeFriend(fid,button){
  window.FBZConfirm.open({
    title:'Удалить из друзей?',
    message:'Пользователь исчезнет из списка друзей. Новый запрос можно будет отправить позже.',
    confirmText:'Удалить',
    onConfirm:async()=>{
      const[{error:firstError},{error:secondError}]=await Promise.all([
        sb.from('friendships').delete().eq('user_id',CU.id).eq('friend_id',fid),
        sb.from('friendships').delete().eq('user_id',fid).eq('friend_id',CU.id)
      ]);
      if(firstError||secondError){
        console.error('Friend removal error:',firstError||secondError);
        toast('Не удалось удалить пользователя','err');
        return false;
      }
      button.closest('.friend-card')?.remove();
      toast('Пользователь удалён из друзей','ok');
      return true;
    }
  });
}
async function cancelFriend(fid,card){await sb.from('friendships').delete().eq('user_id',CU.id).eq('friend_id',fid);card.remove();}
async function handleInvite(code){
  if(!CU){openAuth();return;}
  const{data:invUser}=await sb.rpc('resolve_invite_code',{lookup_code:code}).maybeSingle();
  if(invUser&&invUser.id!==CU.id){await addFriend(invUser.id);}
}

// ─── NOTIFICATIONS ───
async function loadNotifications(){
  if(!CU)return;
  const{data:notifs}=await sb.from('notifications').select('id,user_id,from_user_id,type,message,read,created_at').eq('user_id',CU.id).order('created_at',{ascending:false}).limit(20);
  const unread=(notifs||[]).filter(n=>!n.read).length;
  const badge=document.getElementById('notifBadge');
  if(badge){badge.textContent=unread;badge.classList.toggle('on',unread>0);}
  const incBadge=document.getElementById('inBadge');
  const friendReqs=(notifs||[]).filter(n=>n.type==='friend_request'&&!n.read).length;
  if(incBadge){incBadge.textContent=friendReqs;incBadge.style.display=friendReqs>0?'inline':'none';}
  const list=document.getElementById('notifList');
  if(!notifs?.length){list.innerHTML='<div class="notif-item"><div class="notif-ico">🔔</div><div class="notif-text">Нет уведомлений</div></div>';return;}
  
  list.innerHTML=notifs.map(n=>`<div class="notif-item${!n.read?' unread':''}" onclick="clickNotif('${n.id}')"><div class="notif-ico">${ico({friend_request:'users',like:'heart',comment:'chat',system:'bell'}[n.type]||'bell',16)}</div><div><div class="notif-text">${esc(n.message||'Уведомление')}</div><div class="notif-time">${new Date(n.created_at).toLocaleDateString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div></div>`).join('');
}
async function clickNotif(id){await sb.from('notifications').update({read:true}).eq('id',id);loadNotifications();}
async function markAllRead(){if(!CU)return;await sb.from('notifications').update({read:true}).eq('user_id',CU.id);loadNotifications();closeNotif();}
function toggleNotif(){notifOpen=!notifOpen;const p=document.getElementById('notifPanel');if(notifOpen){p.style.display='flex';p.classList.add('on');}else{p.style.display='none';p.classList.remove('on');}}
function closeNotif(){notifOpen=false;const p=document.getElementById('notifPanel');p.style.display='none';p.classList.remove('on');}

// ─── CHAT ───
async function loadChat(mid){
  if(!mid)return;
  const body=document.getElementById('chatBody');
  body.innerHTML='<div class="loading"><div class="spin"></div></div>';
  const{data:msgs}=await sb.from('chat_messages').select('id,match_id,user_id,message,created_at').eq('match_id',mid).order('created_at',{ascending:true}).limit(80);
  if(!msgs?.length){body.innerHTML='<div class="empty-state" style="padding:40px">👋 Начни обсуждение!</div>';return;}
  const uids=[...new Set(msgs.map(m=>m.user_id))];
  let uMap={};
  if(uids.length){const{data:us}=await sb.from('users').select('id,username,display_name').in('id',uids);(us||[]).forEach(u=>uMap[u.id]=u);}
  body.innerHTML=msgs.map(m=>{const u=uMap[m.user_id];return`<div class="cmsg ${m.user_id===CU?.id?'own':''}">
    ${m.user_id!==CU?.id?`<div class="cmsg-auth">@${esc(u?.username||'user')}</div>`:''}
    <div>${esc(m.message)}</div>
  </div>`;}).join('');
  body.scrollTop=body.scrollHeight;
}
async function sendChat(){
  if(!CU){openAuth();return;}
  const inp=document.getElementById('chatI');
  const msg=inp.value.trim();if(!msg)return;if(msg.length>1000){toast('Сообщение слишком длинное','err');return;}
  const{error}=await sb.from('chat_messages').insert({match_id:chatMID,user_id:CU.id,message:msg});
  if(error){toast('Ошибка отправки','err');console.error(error);return;}
  inp.value='';loadChat(chatMID);
}

// ─── SHARE CARD ───
function openShare(type,data){
  const c=document.getElementById('shareCanvas');
  const ctx=c.getContext('2d');
  c.width=600;c.height=400;
  const css=getComputedStyle(document.documentElement);
  const accent=css.getPropertyValue('--accent').trim()||'#14b8a6';
  const accent2=css.getPropertyValue('--accent2').trim()||'#a7f3d0';

  // Background
  const bg=ctx.createLinearGradient(0,0,600,400);
  bg.addColorStop(0,'#040806');bg.addColorStop(0.52,'#0b1110');bg.addColorStop(1,'#101817');
  ctx.fillStyle=bg;ctx.fillRect(0,0,600,400);

  // Subtle pitch pattern
  ctx.strokeStyle='rgba(167,243,208,0.07)';ctx.lineWidth=2;
  ctx.strokeRect(42,70,516,260);
  ctx.beginPath();ctx.moveTo(300,70);ctx.lineTo(300,330);ctx.stroke();
  ctx.beginPath();ctx.arc(300,200,54,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='rgba(94,234,212,0.04)';ctx.lineWidth=1;
  for(let i=0;i<600;i+=44){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,400);ctx.stroke();}

  // Glow
  const glow=ctx.createRadialGradient(300,200,0,300,200,300);
  glow.addColorStop(0,'rgba(20,184,166,0.1)');glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow;ctx.fillRect(0,0,600,400);

  if(type==='profile'){
    // Logo
    ctx.font='bold 16px "Bebas Neue",sans-serif';ctx.fillStyle='rgba(255,255,255,0.3)';
    ctx.letterSpacing='3px';ctx.fillText('FOOTBAZED',24,36);

    // Lime accent line
    ctx.fillStyle=accent;ctx.fillRect(24,56,80,3);

    // Username
    ctx.font='bold 42px "Bebas Neue",sans-serif';ctx.fillStyle='#eef0ff';
    ctx.fillText(data.name||'Аноним',24,110);

    ctx.font='14px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#8890b8';
    ctx.fillText('@'+(data.username||'user'),24,132);

    // Stats boxes
    const stats=[
      {v:String(data.ratings||0),l:'Оценок'},
      {v:data.avg||'—',l:'Средняя'},
      {v:String(data.likes||0),l:'Лайков'},
      {v:String(data.friends||0),l:'Друзей'}
    ];
    const bw=130,bh=90,startX=24,startY=160,gap=10;
    stats.forEach((s,i)=>{
      const x=startX+i*(bw+gap);
      ctx.fillStyle='rgba(255,255,255,0.03)';
      ctx.beginPath();ctx.roundRect(x,startY,bw,bh,12);ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.beginPath();ctx.roundRect(x,startY,bw,bh,12);ctx.stroke();
      ctx.font='bold 32px "Bebas Neue",sans-serif';ctx.fillStyle=accent2;
      ctx.fillText(s.v,x+16,startY+42);
      ctx.font='10px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#4a5070';
      ctx.fillText(s.l.toUpperCase(),x+16,startY+64);
    });

    // Level badge
    ctx.fillStyle='rgba(167,243,208,0.08)';
    ctx.beginPath();ctx.roundRect(24,280,200,36,18);ctx.fill();
    ctx.strokeStyle='rgba(167,243,208,0.2)';ctx.beginPath();ctx.roundRect(24,280,200,36,18);ctx.stroke();
    ctx.font='bold 13px "Plus Jakarta Sans",sans-serif';ctx.fillStyle=accent2;
    ctx.fillText(data.level||'🌱 Новичок',40,303);

    // Footer
    ctx.font='11px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#4a5070';
    ctx.fillText('footbazed.com',24,380);

  } else if(type==='rating'){
    // Match rating share card
    ctx.font='bold 16px "Bebas Neue",sans-serif';ctx.fillStyle='rgba(255,255,255,0.3)';
    ctx.fillText('FOOTBAZED',24,36);
    ctx.fillStyle=accent;ctx.fillRect(24,56,80,3);

    ctx.font='bold 28px "Bebas Neue",sans-serif';ctx.fillStyle='#eef0ff';
    ctx.fillText(data.match||'',24,100);

    ctx.font='bold 120px "Bebas Neue",sans-serif';ctx.fillStyle=accent2;
    ctx.fillText(data.score+'/10',24,240);

    if(data.comment){
      ctx.font='italic 14px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#8890b8';
      const words=data.comment.split(' ');let line='',y=280;
      words.forEach(w=>{
        if(ctx.measureText(line+w).width>540){ctx.fillText('"'+line.trim()+'"',24,y);y+=22;line='';}
        line+=w+' ';
      });
      if(line)ctx.fillText('"'+line.trim()+'"',24,y);
    }

    ctx.font='bold 13px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#8890b8';
    ctx.fillText('by @'+(data.username||'user'),24,360);
    ctx.font='11px "Plus Jakarta Sans",sans-serif';ctx.fillStyle='#4a5070';
    ctx.fillText('footbazed.com',24,380);
  }

  FBZOverlay.open('shareOv','.share-box button');
}
function closeShare(){FBZOverlay.close('shareOv');}
function downloadShare(){
  const c=document.getElementById('shareCanvas');
  const a=document.createElement('a');
  a.download='footbazed-card.png';a.href=c.toDataURL('image/png');a.click();
}
async function copyShare(){
  try{
    const c=document.getElementById('shareCanvas');
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
    toast('📋 Карточка скопирована!','ok');
  }catch(e){downloadShare();toast('Скачано (копирование не поддерживается)','ok');}
}

function openSettings(){
  const ov=document.getElementById('settingsOv');
  if(!ov)return;
  window.FBZAppearance?.syncControls();
  const profileUrl=CU?.id?`${window.location.origin}${window.location.pathname}#profile/${encodeURIComponent(CU.id)}`:'—';
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
  FBZOverlay.open('settingsOv','input[name="setTheme"]');
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
  const navIcons={Главная:'home',Матчи:'football',Лента:'feed',Лидеры:'trophy',Друзья:'users'};
  document.querySelectorAll('.nav-link').forEach(a=>{
    const t=a.textContent.trim();if(navIcons[t])a.innerHTML=ico(navIcons[t],15)+' '+t;
  });
  // Mobile nav
  document.querySelectorAll('[data-i]').forEach(s=>{s.innerHTML=ico(s.dataset.i,s.classList.contains('mob-nav-icon')?20:16);});
  // Page titles
  const pgIcons={'Матчи':'football','Лента оценок':'feed','Таблица лидеров':'trophy','Друзья и сообщество':'users','Админ-панель':'settings'};
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
