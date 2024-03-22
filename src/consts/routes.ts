const home = "/";
const miscArticle = "/articles/:id";
const life = "/life";
const code = "/code";
const guides = "/guides";
const guidesArticle = "/guides/:id";
const projects = "/projects";
const games = "/games";
const contact = "/contact";
const login = "/login";
const secret = {
  home: "/secret",
  life: "/secret/life",
  code: "/secret/code",
  guides: "/secret/guides",
  projects: "/secret/projects",
  games: "/secret/games",
  editor: "/secret/editor",
  editorMaterial: "/secret/editor/:id",
  extMaterialEditor: "/secret/ext-material-editor",
  extMaterialExistingMaterial: "/secret/ext-material-editor/:id",
  guideEditor: "/secret/guide-editor",
  guideEditorExistingMaterial: "/secret/guide-editor/:id",
  fileUpload: "/secret/file-upload",
};

export default {
  home,
  miscArticle,
  life,
  code,
  games,
  guides,
  guidesArticle,
  projects,
  contact,
  login,
  secret,
};
