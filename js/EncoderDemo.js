(function() {
  var $bufferSize, $cancel, $dateTime, $encodingProcess, $microphone, $microphoneLevel, $record, $recording, $recordingList, $testToneLevel, $timeDisplay, BUFFER_SIZE, URL, audioContext, disableControlsOnRecord, encoder, encodingProcess, iDefBufSz, microphone, microphoneLevel, minSecStr, mixer, processor, saveRecording, startRecording, startRecordingProcess, startTime, stopRecording, stopRecordingProcess, testTone, testToneLevel, updateBufferSizeText, updateDateTime, worker;

  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

  URL = window.URL || window.webkitURL;

  audioContext = new AudioContext;

  if (audioContext.createScriptProcessor == null) {
    audioContext.createScriptProcessor = audioContext.createJavaScriptNode;
  }

  $testToneLevel = $('#test-tone-level');

  $microphone = $('#microphone');

  $microphoneLevel = $('#microphone-level');

  $encodingProcess = $('input[name="encoding-process"]');

  $bufferSize = $('#buffer-size');

  $recording = $('#recording');

  $timeDisplay = $('#time-display');

  $record = $('#record');

  $cancel = $('#cancel');

  $dateTime = $('#date-time');

  $recordingList = $('#recording-list');

  $testToneLevel.attr('disabled', false);

  $testToneLevel[0].valueAsNumber = 0;

  $microphone.attr('disabled', false);

  $microphone[0].checked = false;

  $microphoneLevel.attr('disabled', false);

  $microphoneLevel[0].valueAsNumber = 0;

  $encodingProcess.attr('disabled', false);

  $encodingProcess[0].checked = true;

  $bufferSize.attr('disabled', false);

  testTone = (function() {
    var lfo, osc, oscMod, output;
    osc = audioContext.createOscillator();
    lfo = audioContext.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 2;
    oscMod = audioContext.createGain();
    osc.connect(oscMod);
    lfo.connect(oscMod.gain);
    output = audioContext.createGain();
    output.gain.value = 0.5;
    oscMod.connect(output);
    osc.start();
    lfo.start();
    return output;
  })();

  testToneLevel = audioContext.createGain();

  testToneLevel.gain.value = 0;

  testTone.connect(testToneLevel);

  microphoneLevel = audioContext.createGain();

  microphoneLevel.gain.value = 0;

  mixer = audioContext.createGain();

  testToneLevel.connect(mixer);

  microphone = void 0;

  microphoneLevel.connect(mixer);

  mixer.connect(audioContext.destination);

  $testToneLevel.on('input', function() {
    var level;
    level = $testToneLevel[0].valueAsNumber / 100;
    testToneLevel.gain.value = level * level;
  });

  $microphoneLevel.on('input', function() {
    var level;
    level = $microphoneLevel[0].valueAsNumber / 100;
    microphoneLevel.gain.value = level * level;
  });

  $microphone.click(function() {
    if (microphone == null) {
      navigator.getUserMedia({
        audio: true
      }, function(stream) {
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(microphoneLevel);
        $microphone.attr('disabled', true);
        return $microphoneLevel.removeClass('hidden');
      }, function(error) {
        $microphone[0].checked = false;
        return window.alert("Could not get audio input.");
      });
    }
  });

  encodingProcess = 'separate';

  $encodingProcess.click(function(event) {
    encodingProcess = $(event.target).attr('mode');
  });

  processor = audioContext.createScriptProcessor(null, 2, 2);

  mixer.connect(processor);

  processor.connect(audioContext.destination);

  BUFFER_SIZE = [256, 512, 1024, 2048, 4096, 8192, 16384];

  iDefBufSz = BUFFER_SIZE.indexOf(processor.bufferSize);

  $bufferSize[0].valueAsNumber = iDefBufSz;

  updateBufferSizeText = function() {
    var iBufSz, text;
    iBufSz = $bufferSize[0].valueAsNumber;
    text = "" + BUFFER_SIZE[iBufSz];
    if (iBufSz === iDefBufSz) {
      text += ' (browser default)';
    }
    $('#buffer-size-text').html(text);
  };

  updateBufferSizeText();

  $bufferSize.on('input', function() {
    updateBufferSizeText();
  });

  saveRecording = function(blob) {
    var html, time, url;
    time = new Date();
    url = URL.createObjectURL(blob);
    html = ("<p recording='" + url + "'>") + ("<audio controls src='" + url + "'></audio> &nbsp; ") + ("" + (time.toString()) + " &nbsp; ") + ("<a class='btn btn-default' href='" + url + "' download='recording.wav'>") + "Save..." + "</a> " + ("<button class='btn btn-danger' recording='" + url + "'>Delete</button>");
    "</p>";
    $recordingList.prepend($(html));
  };

  $recordingList.on('click', 'button', function(event) {
    var url;
    url = $(event.target).attr('recording');
    $("p[recording='" + url + "']").remove();
    URL.revokeObjectURL(url);
  });

  worker = new Worker('js/EncoderWorker.js');

  worker.onmessage = function(event) {
    saveRecording(event.data.blob);
  };

  encoder = void 0;

  startRecordingProcess = function() {
    var bufSz;
    bufSz = BUFFER_SIZE[$bufferSize[0].valueAsNumber];
    if (bufSz !== processor.bufferSize) {
      mixer.disconnect();
      mixer.connect(audioContext.destination);
      processor.disconnect();
      processor = audioContext.createScriptProcessor(bufSz, 2, 2);
      mixer.connect(processor);
      processor.connect(audioContext.destination);
    }
    if (encodingProcess === 'direct') {
      encoder = new WavAudioEncoder(audioContext.sampleRate, 2);
      processor.onaudioprocess = function(event) {
        var ch;
        encoder.encode((function() {
          var _i, _results;
          _results = [];
          for (ch = _i = 0; _i < 2; ch = ++_i) {
            _results.push(event.inputBuffer.getChannelData(ch));
          }
          return _results;
        })());
      };
    } else {
      worker.postMessage({
        command: 'start',
        process: encodingProcess,
        sampleRate: audioContext.sampleRate,
        numChannels: 2
      });
      processor.onaudioprocess = function(event) {
        var ch;
        worker.postMessage({
          command: 'record',
          buffers: (function() {
            var _i, _results;
            _results = [];
            for (ch = _i = 0; _i < 2; ch = ++_i) {
              _results.push(event.inputBuffer.getChannelData(ch));
            }
            return _results;
          })()
        });
      };
    }
  };

  stopRecordingProcess = function(finish) {
    processor.onaudioprocess = null;
    if (encodingProcess === 'direct') {
      if (finish) {
        saveRecording(encoder.finish());
      } else {
        encoder.cancel();
      }
    } else {
      worker.postMessage({
        command: finish ? 'finish' : 'cancel'
      });
    }
  };

  startTime = null;

  minSecStr = function(n) {
    return (n < 10 ? "0" : "") + n;
  };

  updateDateTime = function() {
    var sec;
    $dateTime.html((new Date).toString());
    if (startTime != null) {
      sec = Math.floor((Date.now() - startTime) / 1000);
      $timeDisplay.html("" + (minSecStr(sec / 60 | 0)) + ":" + (minSecStr(sec % 60)));
    }
  };

  window.setInterval(updateDateTime, 200);

  disableControlsOnRecord = function(disabled) {
    if (microphone == null) {
      $microphone.attr('disabled', disabled);
    }
    $bufferSize.attr('disabled', disabled);
    $encodingProcess.attr('disabled', disabled);
  };

  startRecording = function() {
    startTime = Date.now();
    $recording.removeClass('hidden');
    $record.html('STOP');
    $cancel.removeClass('hidden');
    disableControlsOnRecord(true);
    startRecordingProcess();
  };

  stopRecording = function(finish) {
    startTime = null;
    $timeDisplay.html('00:00');
    $recording.addClass('hidden');
    $record.html('RECORD');
    $cancel.addClass('hidden');
    disableControlsOnRecord(false);
    stopRecordingProcess(finish);
  };

  $record.click(function() {
    if (startTime != null) {
      stopRecording(true);
    } else {
      startRecording();
    }
  });

  $cancel.click(function() {
    stopRecording(false);
  });

}).call(this);
