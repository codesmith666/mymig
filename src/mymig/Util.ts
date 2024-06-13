export class Util {
  static ucfirst(str: string) {
    return (str[0] || "").toUpperCase() + str.slice(1).toLowerCase();
  }
  static parseComment(value: string) {
    value = value.trim();
    const index = value.indexOf(" ");
    if (index >= 0) {
      const id = value.slice(0, index);
      const comment = value.slice(index + 1);
      return { id, comment };
    }
    return { id: value, comment: "" };
  }
  static buildComment(id: string, comment: string) {
    return "'" + id + " " + comment.replace("'", "''") + "'";
  }
}
