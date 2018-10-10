const path = require("path");
const fs = require("fs");
const pkgPath = path.join(__dirname, "../package.json");
const pkg = require(pkgPath);

function increaseVersion(version) {
  const max = 20;
  const vs = version.split(".").map(i => +i);
  let len = vs.length;
  while (len--) {
    if (++vs[len] < max) {
      break;
    }
    vs[len] = 0;
  }
  return vs.join(".");
}

function updatePkg() {
  pkg.version = increaseVersion(pkg.version);
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
}

exports.increaseVersion = increaseVersion;
// increaseVersion
// };

if (!module.parent) updatePkg();
