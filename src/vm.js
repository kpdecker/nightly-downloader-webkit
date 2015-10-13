import {exec} from 'child_process';
import {dirname, join, resolve} from 'path';
import rimraf from 'rimraf';

export function extract(zipFile) {
  zipFile = resolve(zipFile);

  let cwd = dirname(zipFile),
      base = 'MsEdge-Win10-VMware',
      vmDir = `${cwd}/`,
      vmx = join(vmDir, `${base}.vmwarevm`);

  return stopVM(vmx)
      .then(() => deleteVM(vmx))
      .then(() => cleanup(join(cwd, base)))
      .then(() => decompress(zipFile, cwd))
      .then((ovfFile) => initVM(join(cwd, ovfFile), vmDir))
      .then(() => upgradeVM(vmx))
      .then(() => startVM(vmx))
      .then(() => cleanup(join(cwd, base)))
      .then(() => stopVM(vmx));
}

function decompress(file, cwd) {
  return run(`7za -y x "${file}"`, {cwd})
      .then((stdout) => (/Extracting *(.*\.ovf)/.exec(stdout) || [])[1]);
}

function stopVM(vmx) {
  return run(`vmrun stop "${vmx}"`);
}

function deleteVM(vmx) {
  console.log(`Removing old VM from ${vmx}`);
  return run(`vmrun deleteVM "${vmx}"`);
}
function cleanup(vmdir) {
  return new Promise((resolve, reject) => {
    rimraf(vmdir, function(err) {
      /* istanbul ignore if */
      if (err && err.code !== 'ENOENT') {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function initVM(ovfFile, dir) {
  console.log('Installing vm');
  return run(`"/Applications/VMware OVF Tool/ovftool" -o "${ovfFile}" "${dir}"`);
}

function upgradeVM(vmx) {
  console.log('Upgrading vm');
  return run(`vmrun upgradevm "${vmx}"`);
}

function startVM(vmx) {
  return run(`vmrun start "${vmx}"`)
      // Introduce our own arbitrary wait as the Win10 VM seems to have issues when sending
      // VMTools commands immediately after the first startup.
      .then(() => delay(30 * 1000));
}

function delay(timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

function run(command, options) {
  return new Promise((resolve, reject) => {
    console.log('run', command);
    exec(command, options, function(err, stdout, stderr) {
      /* istanbul ignore if */
      if (err
          && !(/The virtual machine is not powered on/.test(stdout))
          && !(/The virtual machine cannot be found/.test(stdout))) {
        console.log(err, stdout, stderr);
        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}
