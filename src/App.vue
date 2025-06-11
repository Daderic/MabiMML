<template>
  <!--img alt="Vue logo" src="./assets/logo.png"></!-->
  <div id="app">
    <PatternEditor />
  </div>
</template>

<script>
import PatternEditor from './components/PatternEditor.vue';
import PianoRoll from './components/PianoRoll.vue';

export default {
  name: 'App',
  components: {
    PatternEditor
  }
}
</script>

<style>
  #app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
    position: fixed;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    background-color: #ddd;
  }
</style>
