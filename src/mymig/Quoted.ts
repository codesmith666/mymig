export class Quoted {
  value = "";
  addString(value: string, _line: number) {
    this.value = (this.value || "") + value;
  }
}
