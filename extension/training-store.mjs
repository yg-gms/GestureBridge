export class TrainingStore {
  constructor(session, storage, onChange = () => {}) {
    this.session = session;
    this.storage = storage;
    this.onChange = onChange;
    this.pending = Promise.resolve();
    this.revision = 0;
    this.status = { message: 'Loading saved setup…', error: false };
  }

  report(message, error = false, action = 'save') {
    this.status = { message, error, action };
    this.onChange(this.status);
  }

  async load() {
    try {
      const { training } = await this.storage.get('training');
      if (training !== undefined && !this.session.restoreTraining(training)) {
        this.report(
          'Saved setup is incompatible or damaged. Reset setup or teach fresh poses.',
          true,
          'load',
        );
        return false;
      }
      this.report(
        training
          ? 'Saved poses restored · fresh calibration required.'
          : 'Your poses will save automatically on this computer.',
      );
      return true;
    } catch {
      this.report(
        'Could not read your saved setup. Retry loading, or teach fresh poses to replace it.',
        true,
        'load',
      );
      return false;
    }
  }

  save() {
    const training = this.session.exportTraining();
    const revision = ++this.revision;
    this.report('Saving poses…');
    this.pending = this.pending.then(async () => {
      try {
        await this.storage.set({ training });
        if (revision === this.revision)
          this.report('Poses saved on this computer.');
        return true;
      } catch {
        if (revision === this.revision)
          this.report(
            'Poses are not saved. Keep this panel open and retry saving.',
            true,
          );
        return false;
      }
    });
    return this.pending;
  }
}
