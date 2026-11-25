#!/bin/sh
# Installs the latest wherewerewe release binary for this machine into ~/.local/bin, or into the
# folder in WHEREWEREWE_INSTALL_DIR, with www as a link to it. No Bun or Node is needed. The binary
# goes into place only when its hash matches its line in the release's SHA256SUMS.
#
#   curl -fsSL https://raw.githubusercontent.com/zgeoff/wherewerewe/main/install.sh | sh
#
# WHEREWEREWE_RELEASE_URL points the download at another folder of release files, such as a local
# build. The script runs no sudo, writes only in the install folder, and edits no shell profile.

# main runs last, so a download cut short never runs half the script
main() {
  set -eu

  # each path is made absolute and plain once, here, so the cleanup walks the same folders that
  # mkdir made, whatever slashes, dots or relative form the caller gave
  base="${WHEREWEREWE_RELEASE_URL:-https://github.com/zgeoff/wherewerewe/releases/latest/download}"
  while [ "$base" != "${base%/}" ]; do
    base="${base%/}"
  done
  hide_user_info "$base"
  normalise_path "${WHEREWEREWE_INSTALL_DIR:-$HOME/.local/bin}"
  dir="$normalised"

  made=""
  tmp=""
  trap clean_up EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  # a closed stdout fails the echo, so the run fails and cleans up, and never dies half done
  trap '' PIPE

  case "$(uname -s)" in
    Darwin) os="darwin" ;;
    Linux) os="linux" ;;
    *) fail "no binary for $(uname -s)" ;;
  esac

  case "$(uname -m)" in
    arm64 | aarch64) arch="arm64" ;;
    x86_64 | amd64) arch="x64" ;;
    *) fail "no binary for $(uname -m)" ;;
  esac

  asset="wherewerewe-$os-$arch"

  # mv would put the download inside a folder that stands where the binary goes
  if [ -d "$dir/wherewerewe" ]; then
    fail "$dir/wherewerewe is a folder, and the script leaves it"
  fi

  # a failed run removes the folders it made, the temp file and a www link it made, so an earlier
  # install stays as it was; the path is absolute, so the walk ends at / at the latest
  probe="$dir"
  while [ ! -d "$probe" ]; do
    made="$probe"
    probe="${probe%/*}"
    probe="${probe:-/}"
  done

  mkdir -p "$dir"
  tmp=$(mktemp "$dir/.wherewerewe.XXXXXX")

  # curl runs without -S, so a failed download prints only the script's own line
  echo "wherewerewe: downloading $shown/$asset"
  curl -fsL "$base/$asset" -o "$tmp" || fail "could not download $shown/$asset"

  # nothing goes into place before the hash of the download matches its line in SHA256SUMS
  sums=$(curl -fsL "$base/SHA256SUMS") || fail "could not download $shown/SHA256SUMS"
  expected=$(printf '%s\n' "$sums" | awk -v asset="$asset" '$2 == asset { print $1 }')

  if [ -z "$expected" ]; then
    fail "SHA256SUMS has no line for $asset"
  fi

  hash_download

  if [ "$actual" != "$expected" ]; then
    fail "$asset does not match the release's SHA256SUMS"
  fi

  # run the download before it replaces anything, so a binary that cannot run leaves the old one;
  # hash it again after, because a binary that ran could have changed its own file
  chmod +x "$tmp"
  version=$("$tmp" --version 2> /dev/null) || fail "the downloaded binary does not run on this machine"
  hash_download

  if [ "$actual" != "$expected" ]; then
    fail "$asset changed when it ran, so it no longer matches the release's SHA256SUMS"
  fi

  # the rename over the old file is the last step that can fail the run, and it keeps the path
  # that the hook entries name; www then links to the binary that is already in place
  mv "$tmp" "$dir/wherewerewe"
  tmp=""
  made=""
  link_www
  echo "wherewerewe: installed $version to $dir/wherewerewe" || :

  case ":$PATH:" in
    *":$dir:"*) ;;
    *) echo "wherewerewe: add $dir to your PATH" || : ;;
  esac
}

# Sets actual to the SHA-256 of the download, with whichever of sha256sum and shasum the machine has.
hash_download() {
  if command -v sha256sum > /dev/null 2>&1; then
    hashed=$(sha256sum "$tmp") || fail "sha256sum could not hash the download"
  elif command -v shasum > /dev/null 2>&1; then
    hashed=$(shasum -a 256 "$tmp") || fail "shasum could not hash the download"
  else
    fail "needs sha256sum or shasum to check the download"
  fi

  actual="${hashed%% *}"
}

# Sets shown to the URL with any user name and password taken out, for the lines the script prints.
hide_user_info() {
  case "$1" in
    *://*)
      url_scheme="${1%%://*}"
      url_rest="${1#*://}"
      url_authority="${url_rest%%/*}"
      url_path="${url_rest#"$url_authority"}"
      shown="$url_scheme://${url_authority##*@}$url_path"
      ;;
    *) shown="$1" ;;
  esac
}

clean_up() {
  status=$?

  if [ -n "$tmp" ]; then
    rm -f "$tmp"
  fi

  # a mkdir -p that failed part way leaves the upper folders without the lower ones, so a missing
  # folder is passed over, and the walk stops at the first one that holds something
  if [ "$status" -ne 0 ] && [ -n "$made" ]; then
    folder="$dir"

    while { [ ! -d "$folder" ] || rmdir "$folder" 2> /dev/null; } && [ "$folder" != "$made" ]; do
      folder="${folder%/*}"
    done
  fi
}

# Sets normalised to the path made absolute against the current folder, with no empty, . or ..
# part and no trailing slash. A .. after a folder that exists goes to that folder's parent on disk,
# as mkdir would, even through a link; after a folder still to make, it drops that folder.
normalise_path() {
  case "$1" in
    /*) path_left="$1" ;;
    *) path_left="$PWD/$1" ;;
  esac

  normalised=""

  while [ -n "$path_left" ]; do
    path_part="${path_left%%/*}"

    case "$path_left" in
      */*) path_left="${path_left#*/}" ;;
      *) path_left="" ;;
    esac

    case "$path_part" in
      "" | .) ;;
      ..)
        if [ -d "${normalised:-/}" ]; then
          normalised=$(cd -P -- "${normalised:-/}/.." && pwd -P)
          normalised="${normalised%/}"
        else
          normalised="${normalised%/*}"
        fi
        ;;
      *) normalised="$normalised/$path_part" ;;
    esac
  done

  normalised="${normalised:-/}"
}

fail() {
  echo "wherewerewe: $1" >&2
  exit 1
}

# www is a link to wherewerewe. A www link to wherewerewe stays as it is, and a www that is anything
# else, such as another tool's, stays too. The binary is in place by now, so a link that cannot be
# made leaves a working install.
link_www() {
  if [ ! -e "$dir/www" ] && [ ! -L "$dir/www" ]; then
    ln -s wherewerewe "$dir/www" 2> /dev/null ||
      echo "wherewerewe: could not make $dir/www a link to wherewerewe, so type wherewerewe in place of www" >&2 ||
      :
  elif [ -L "$dir/www" ] && { [ "$(readlink "$dir/www")" = wherewerewe ] || [ "$(readlink "$dir/www")" = "$dir/wherewerewe" ]; }; then
    :
  else
    echo "wherewerewe: $dir/www is not a link to wherewerewe, so the script leaves it." || :
  fi
}

main
